-- =============================================================
-- Migration: 20260607000000_premade_copy_model.sql
--
-- Backend Completion Plan, Stage 4 (rewrite).
--
-- Replaces the premade-deck *subscription-with-sync* model with a
-- *copy-as-starting-point* model. After this migration, a user who
-- copies a premade deck owns a standalone deck — there is no
-- subscription junction, no version drift to track, no merge/sync
-- workflow, and no special path through deleteDeck. Refreshing
-- content means deleting the copy and copying again, with the
-- FSRS-progress cost surfaced to the learner.
--
-- Why this is a destructive forward-only migration: the subscribe
-- model is being abandoned end-to-end. Per docs/DATABASE.md
-- migration discipline, this is OK only because the change happens
-- pre-launch; rollback is restore-from-backup. Do NOT ship a
-- downgrade migration.
--
-- Order of operations:
--
--   1. Drop the two functions that reference the subscription
--      table or the version column before the table/column goes,
--      so neither leaves a dangling dependency.
--   2. Drop `user_premade_subscriptions` (the junction table). FK
--      cascade from premade_decks / profiles already handles
--      cleanup if the user/deck disappeared first; here we drop
--      the table outright. Cascade also removes the RLS policy
--      and the UNIQUE (user_id, premade_deck_id) constraint.
--   3. Drop `premade_decks.version` and its positive-CHECK. The
--      partial index `decks_source_premade_id_idx` (which uses
--      `source_premade_id IS NOT NULL`, not `is_premade_fork`)
--      stays — it's still useful for "decks that came from a
--      premade source" lookups during copy.
--   4. Drop `decks.is_premade_fork`. After this step the column
--      is no longer load-bearing — deleteDeck no longer needs
--      special-case logic for premade forks, and all deck-delete
--      paths converge on the FK-cascade DELETE.
--   5. Create `copy_premade_deck`, which atomically inserts one
--      new `decks` row plus N personal card copies (fresh FSRS
--      state) in a single function call. Embeddings are carried
--      from the source row so semantic search works on day 1.
--      Source `is_active = TRUE` is validated; FALSE → 404 via
--      SQLSTATE 02000.
--
-- The companion service-layer refactor in
-- apps/api/src/services/premade.service.ts (Stage 4 same PR)
-- deletes subscribe*/unsubscribe*/list* and adds copyPremadeDeck.
-- =============================================================


-- ─── 1. Drop the functions that reference the soon-to-be-dropped table ──────

DROP FUNCTION IF EXISTS public.subscribe_to_premade_deck(UUID, UUID);
DROP FUNCTION IF EXISTS public.unsubscribe_from_premade_deck(UUID, UUID);


-- ─── 2. Drop the subscription junction table ────────────────────────────────
-- CASCADE removes: the partial UNIQUE (user_id, premade_deck_id) index, the
-- single user_id index, and the RLS policy. There are no FK references INTO
-- this table from anywhere else in the schema — the table is purely a
-- junction OUT to profiles + premade_decks.

DROP TABLE IF EXISTS public.user_premade_subscriptions CASCADE;


-- ─── 3. Drop premade_decks.version and its positive-CHECK ───────────────────
-- The CHECK was added in 20260504000006 to guard "version >= 1". Both go
-- because the copy model has no notion of a tracked version: a deck's
-- content is whatever it was at copy time.

ALTER TABLE public.premade_decks DROP CONSTRAINT IF EXISTS premade_decks_version_positive;
ALTER TABLE public.premade_decks DROP COLUMN IF EXISTS version;


-- ─── 4. Drop decks.is_premade_fork ──────────────────────────────────────────
-- Originally used by deleteDeck to dispatch to the unsubscribe RPC for
-- forks. With no subscription table, there's nothing to clean up — all
-- decks delete identically via FK cascade to cards.

ALTER TABLE public.decks DROP COLUMN IF EXISTS is_premade_fork;


-- ─── 5. New copy_premade_deck RPC ───────────────────────────────────────────
-- Atomic. Inserts one decks row + N card copies in one function call.
--
-- Fresh FSRS state on every cloned card (state=0, due=NOW(), reps=0,
-- lapses=0, scheduled_days=0, learning_steps=0, stability/difficulty=0,
-- last_review=NULL). Embedding + embedding_updated_at carried from the
-- source row, mirroring the embedding-aware clone that 20260507000003
-- introduced for the subscribe path.
--
-- `source_premade_id` is set on the new decks row for attribution
-- ("started from premade <name>") — but unlike the old model it does NOT
-- gate any future behavior. Two copies of the same premade deck yield two
-- independent rows; no uniqueness constraint blocks duplicates.
--
-- SECURITY DEFINER + pinned search_path + explicit GRANT EXECUTE follow
-- the same hardening pattern the rest of the SECURITY DEFINER fleet uses
-- (see 20260504000008 / 20260504000009).

CREATE FUNCTION public.copy_premade_deck(
  p_user_id         UUID,
  p_premade_deck_id UUID
)
RETURNS TABLE (
  deck_id    UUID,
  card_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_premade        public.premade_decks%ROWTYPE;
  v_new_deck_id    UUID;
  v_inserted_count INT;
BEGIN
  -- Validate that the source premade deck exists and is active. We do not
  -- expose inactive decks to copying — the catalogue list also filters
  -- on is_active, so callers should never reach here with an inactive id
  -- through the public API.
  SELECT * INTO v_premade
  FROM public.premade_decks
  WHERE id = p_premade_deck_id AND is_active = TRUE;

  IF NOT FOUND THEN
    -- SQLSTATE 02000 (no_data_found) is the canonical "not found" signal the
    -- rest of the API translates to HTTP 404 (see leech.service.ts and
    -- card.service.ts for prior art).
    RAISE EXCEPTION 'premade_deck_not_found' USING ERRCODE = '02000';
  END IF;

  -- Insert the new owned deck. Description and deck_type carry from the
  -- source for a sensible default; the user can rename / re-classify
  -- afterwards through the regular updateDeck path. card_count stays at
  -- the column default (0) — it's maintained by the card-count trigger
  -- (20260502000005) as the bulk INSERT below fires per row.
  INSERT INTO public.decks (
    user_id, name, description, deck_type, source_premade_id
  )
  VALUES (
    p_user_id, v_premade.name, v_premade.description, v_premade.deck_type, p_premade_deck_id
  )
  RETURNING id INTO v_new_deck_id;

  -- Bulk-clone source cards (premade source rows live with user_id IS NULL
  -- and premade_deck_id = the catalogue id). Fresh FSRS state per copy;
  -- embedding carried so similarity search works without a backfill.
  WITH cloned AS (
    INSERT INTO public.cards (
      user_id, deck_id, premade_deck_id,
      layout_type, fields_data, card_type, jlpt_level, tags,
      due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps,
      reps, lapses, state, last_review,
      embedding, embedding_updated_at
    )
    SELECT
      p_user_id, v_new_deck_id, NULL,
      c.layout_type, c.fields_data, c.card_type, c.jlpt_level, COALESCE(c.tags, '{}'),
      NOW(), 0, 0,
      0, 0, 0,
      0, 0, 0, NULL,
      c.embedding, c.embedding_updated_at
    FROM public.cards c
    WHERE c.premade_deck_id = p_premade_deck_id
      AND c.user_id IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted_count FROM cloned;

  RETURN QUERY SELECT v_new_deck_id, v_inserted_count;
END;
$$;

-- Supabase service-role does not auto-receive EXECUTE on new functions;
-- the explicit grant is required for the API client to call this RPC.
GRANT EXECUTE ON FUNCTION public.copy_premade_deck(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.copy_premade_deck(UUID, UUID) IS
  'Backend Completion Plan Stage 4 (copy model). Clones a premade deck
   into a new standalone deck owned by p_user_id. Allows duplicates by
   design — refreshing content means deleting the deck and copying again,
   accepting the FSRS-progress cost explicitly. Raises premade_deck_not_found
   (SQLSTATE 02000) when the source is inactive or missing.';
