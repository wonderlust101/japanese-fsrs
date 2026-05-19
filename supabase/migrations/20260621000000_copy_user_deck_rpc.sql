-- =============================================================
-- Migration: 20260621000000_copy_user_deck_rpc.sql
--
-- Adds `copy_user_deck` — duplicates a user's own deck into a new
-- standalone deck. Mirrors `copy_premade_deck` (20260607000000) but
-- sources from a user-owned deck instead of a premade catalogue row.
--
-- Behavior contract (locked in via user decisions):
--   - FSRS state on the new cards is reset (state=0, due=NOW, reps=0,
--     lapses=0, learning_steps=0). Same shape as copy_premade_deck.
--   - Tags are NOT carried into the copy.
--   - `is_suspended` is NOT carried; new cards start unsuspended.
--   - Embeddings ARE carried so similarity search works day-one.
--   - Caller may supply a target name; if NULL/empty the function
--     resolves "<source name> (Copy)", appending " (Copy 2)", " (Copy 3)"
--     etc. until the name is unique within the user's decks.
--   - `source_premade_id` is NOT carried — a copy of a copy is a fresh
--     user deck, not attribution back to a catalogue entry. This matches
--     how `copy_card` already drops `premade_deck_id` for personal copies.
--   - Premade source decks (`user_id IS NULL`) are rejected via the
--     ownership check (`p_user_id <> user_id`). Premade copying still
--     goes through `copy_premade_deck`, which has different semantics
--     (active-flag gating, premade attribution).
--
-- Security:
--   - SECURITY DEFINER, `SET search_path = ''`, explicit
--     `GRANT EXECUTE ... TO service_role`. Same posture as every other
--     RPC introduced after Stage 4.
--   - Ownership is enforced server-side; the controller-layer auth
--     middleware can't be the only gate because the function is a
--     SECURITY DEFINER and runs with elevated privileges.
-- =============================================================


CREATE FUNCTION public.copy_user_deck(
  p_user_id          UUID,
  p_source_deck_id   UUID,
  p_target_name      TEXT
)
RETURNS TABLE (deck_id UUID, card_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source         RECORD;
  v_new_deck_id    UUID;
  v_inserted_count INT;
  v_resolved_name  TEXT;
  v_candidate      TEXT;
  v_suffix         INT;
BEGIN
  -- ── 1. Verify the source deck exists and is owned by the caller. ──────
  -- `user_id IS NULL` (premade source decks) falls through to the
  -- "not found" branch by design — premade copying has its own RPC.
  SELECT id, user_id, name, description, deck_type
    INTO v_source
    FROM public.decks
   WHERE id = p_source_deck_id;

  IF v_source.id IS NULL OR v_source.user_id IS NULL OR v_source.user_id <> p_user_id THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = '02000',
            HINT    = 'Source deck does not exist or does not belong to this user.';
  END IF;

  -- ── 2. Resolve the target name. ───────────────────────────────────────
  -- Caller-supplied name wins (after a trim). Otherwise default to
  -- "<source> (Copy)" and bump a counter until we find a name not
  -- already in use by this user. Loop is bounded to keep a pathological
  -- name collision from spinning forever.
  IF p_target_name IS NOT NULL AND length(trim(p_target_name)) > 0 THEN
    v_resolved_name := trim(p_target_name);
  ELSE
    v_candidate := v_source.name || ' (Copy)';
    v_suffix    := 2;
    WHILE EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.user_id = p_user_id AND d.name = v_candidate
    ) LOOP
      v_candidate := v_source.name || ' (Copy ' || v_suffix || ')';
      v_suffix    := v_suffix + 1;
      -- Defensive ceiling. 1000 is well above any plausible legitimate
      -- collision count; hitting it indicates a bug, not a real user.
      IF v_suffix > 1000 THEN
        RAISE EXCEPTION 'copy_name_collision_overflow'
          USING ERRCODE = '54000',
                HINT    = 'Could not resolve a unique copy name after 1000 attempts.';
      END IF;
    END LOOP;
    v_resolved_name := v_candidate;
  END IF;

  -- ── 3. Insert the new deck row. ───────────────────────────────────────
  -- `source_premade_id` deliberately left NULL — see header.
  INSERT INTO public.decks (
    user_id, name, description, deck_type, source_premade_id
  )
  VALUES (
    p_user_id, v_resolved_name, v_source.description, v_source.deck_type, NULL
  )
  RETURNING id INTO v_new_deck_id;

  -- ── 4. Clone the cards. ───────────────────────────────────────────────
  -- Carry: layout_type, fields_data, jlpt_level, embedding,
  -- embedding_updated_at.
  -- Drop: tags, parent_card_id (the copy is its own sibling family
  -- root inside the new deck), is_suspended, FSRS state, FSRS history.
  -- Skip suspended source cards entirely — including them would
  -- silently restore them in the copy, which contradicts "is_suspended
  -- is not carried."
  WITH cloned AS (
    INSERT INTO public.cards (
      user_id, deck_id, premade_deck_id,
      layout_type, fields_data, jlpt_level, tags,
      due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps,
      reps, lapses, state, last_review,
      embedding, embedding_updated_at
    )
    SELECT
      p_user_id, v_new_deck_id, NULL,
      c.layout_type, c.fields_data, c.jlpt_level, '{}'::text[],
      NOW(), 0, 0,
      0, 0, 0,
      0, 0, 0, NULL,
      c.embedding, c.embedding_updated_at
    FROM public.cards c
    WHERE c.deck_id = p_source_deck_id
      AND c.user_id = p_user_id
      AND c.is_suspended = FALSE
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted_count FROM cloned;

  RETURN QUERY SELECT v_new_deck_id, v_inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_user_deck(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.copy_user_deck(UUID, UUID, TEXT) IS
  'Duplicates a user-owned deck. Resets FSRS state on the cloned cards, '
  'drops tags / suspended flag / parent_card_id, carries embeddings. '
  'Resolves a unique "<name> (Copy [N])" target name when p_target_name is NULL.';
