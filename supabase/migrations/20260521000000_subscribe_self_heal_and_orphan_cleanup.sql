-- =============================================================
-- Migration: 20260521000000_subscribe_self_heal_and_orphan_cleanup.sql
--
-- Fixes the "subscribe → delete fork → re-subscribe = 500" bug.
--
-- Root cause:
--   user_premade_subscriptions has no FK to decks (only to premade_decks).
--   When the user deletes their forked deck via deleteDeck (regular path,
--   not unsubscribe), the decks row vanishes but the subscription row
--   survives orphaned. The next subscribe attempt fails the
--   "already subscribed?" INNER JOIN check (no matching deck), proceeds to
--   INSERT a duplicate subscription row, hits the unique constraint on
--   (user_id, premade_deck_id), and surfaces as 500.
--
-- This migration covers two angles:
--
--   A. One-time cleanup of any orphan subscription rows already in prod.
--      Anti-join DELETE; single statement; both sides indexed.
--
--   B. Make subscribe_to_premade_deck self-healing. The new body splits
--      the JOIN-based "already subscribed?" check into two separate
--      lookups (subscription, deck) and dispatches on four cases:
--        - both exist     → return existing (already_existed = TRUE)
--        - sub w/o deck   → reuse sub, recreate deck + cards (orphan repair)
--        - neither exists → fresh subscribe
--        - deck w/o sub   → insert sub, reuse deck (inverse orphan)
--      Defense-in-depth: handles future orphans from any source plus the
--      brief race window between the cleanup DELETE and any in-flight
--      subscribe call.
--
-- Companion service-layer change (apps/api/src/services/deck.service.ts):
-- deleteDeck now delegates to unsubscribeFromPremadeDeck when the deck
-- is_premade_fork = TRUE, preventing future orphans at the API surface.
-- =============================================================


-- ─── A. Cleanup existing orphan subscriptions ────────────────────────────────
-- Removes any user_premade_subscriptions row whose matching forked deck
-- no longer exists. By definition these rows are invisible to the user
-- (listSubscriptions filters them out) and block the unique constraint
-- on re-subscribe. NOT EXISTS uses an anti-join indexed on both sides.

DELETE FROM user_premade_subscriptions s
WHERE NOT EXISTS (
  SELECT 1 FROM decks d
  WHERE d.user_id           = s.user_id
    AND d.source_premade_id = s.premade_deck_id
    AND d.is_premade_fork   = TRUE
);


-- ─── B. Self-healing subscribe_to_premade_deck ───────────────────────────────
-- Body identical to 20260507000003 except the "already subscribed?" check.
-- The clone INSERT carries embedding + embedding_updated_at as before
-- (audit C4 fix from 20260507000003).

CREATE OR REPLACE FUNCTION subscribe_to_premade_deck(
  p_user_id         UUID,
  p_premade_deck_id UUID
)
RETURNS TABLE (
  subscription_id UUID,
  deck_id         UUID,
  card_count      INT,
  already_existed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_premade           public.premade_decks%ROWTYPE;
  v_existing_sub_id   UUID;
  v_existing_deck_id  UUID;
  v_existing_count    INT;
  v_inserted_count    INT;
BEGIN
  -- Step 1 — validate premade.
  SELECT * INTO v_premade
  FROM public.premade_decks
  WHERE id = p_premade_deck_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premade deck not found' USING ERRCODE = 'P0002';
  END IF;

  -- Step 2a — existing subscription, if any. Indexed by UNIQUE
  -- (user_id, premade_deck_id) on user_premade_subscriptions.
  SELECT s.id INTO v_existing_sub_id
  FROM public.user_premade_subscriptions s
  WHERE s.user_id         = p_user_id
    AND s.premade_deck_id = p_premade_deck_id;

  -- Step 2b — existing fork deck, if any. Indexed by partial
  -- decks_source_premade_id_idx.
  SELECT d.id, d.card_count
    INTO v_existing_deck_id, v_existing_count
  FROM public.decks d
  WHERE d.user_id           = p_user_id
    AND d.source_premade_id = p_premade_deck_id
    AND d.is_premade_fork   = TRUE;

  -- Case 1: both exist → unchanged short-circuit.
  IF v_existing_sub_id IS NOT NULL AND v_existing_deck_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_sub_id, v_existing_deck_id, v_existing_count, TRUE;
    RETURN;
  END IF;

  -- Cases 2/3/4: insert whichever piece is missing.

  IF v_existing_sub_id IS NULL THEN
    INSERT INTO public.user_premade_subscriptions (user_id, premade_deck_id)
    VALUES (p_user_id, p_premade_deck_id)
    RETURNING id INTO v_existing_sub_id;
  END IF;

  IF v_existing_deck_id IS NULL THEN
    INSERT INTO public.decks (
      user_id, name, description, deck_type, is_premade_fork, source_premade_id
    )
    VALUES (
      p_user_id, v_premade.name, v_premade.description, v_premade.deck_type, TRUE, p_premade_deck_id
    )
    RETURNING id INTO v_existing_deck_id;

    -- Clone source cards (premade source rows have user_id IS NULL).
    -- Carries embedding + embedding_updated_at (per audit C4 in 20260507000003).
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
        p_user_id, v_existing_deck_id, NULL,
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
    v_existing_count := v_inserted_count;
  END IF;

  RETURN QUERY SELECT v_existing_sub_id, v_existing_deck_id, v_existing_count, FALSE;
END;
$$;
