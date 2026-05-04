-- ============================================================
-- subscribe_to_premade_deck() RPC
--
-- Wraps the multi-step subscribe flow into a single transaction so the
-- subscription, the personal forked deck, and the card clones either all
-- exist or none do. Replaces the manual TS rollback in premade.service.ts.
--
-- Steps performed atomically:
--   1. Validate the premade deck exists and is active (else NOT_FOUND).
--   2. If the user is already subscribed, return the existing fork.
--   3. Otherwise insert subscription row, insert personal deck row, and
--      bulk-insert clones of the source cards with FSRS state reset to "new".
--
-- Returns: subscription_id, deck_id, card_count, already_existed
-- ============================================================

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
SET search_path = public
AS $$
DECLARE
  v_premade            premade_decks%ROWTYPE;
  v_existing_sub_id    UUID;
  v_existing_deck_id   UUID;
  v_existing_count     INT;
  v_new_sub_id         UUID;
  v_new_deck_id        UUID;
  v_inserted_count     INT;
BEGIN
  -- Step 1 — validate premade deck.
  SELECT * INTO v_premade
  FROM premade_decks
  WHERE id = p_premade_deck_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premade deck not found' USING ERRCODE = 'P0002';
  END IF;

  -- Step 2 — short-circuit if subscription already exists.
  SELECT s.id, d.id, d.card_count
    INTO v_existing_sub_id, v_existing_deck_id, v_existing_count
  FROM user_premade_subscriptions s
  JOIN decks d
    ON d.user_id           = s.user_id
   AND d.source_premade_id = s.premade_deck_id
   AND d.is_premade_fork   = TRUE
  WHERE s.user_id         = p_user_id
    AND s.premade_deck_id = p_premade_deck_id;

  IF v_existing_sub_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_sub_id, v_existing_deck_id, v_existing_count, TRUE;
    RETURN;
  END IF;

  -- Step 3 — create subscription, deck, and clone source cards atomically.
  INSERT INTO user_premade_subscriptions (user_id, premade_deck_id)
  VALUES (p_user_id, p_premade_deck_id)
  RETURNING id INTO v_new_sub_id;

  INSERT INTO decks (
    user_id, name, description, deck_type, is_premade_fork, source_premade_id
  )
  VALUES (
    p_user_id, v_premade.name, v_premade.description, v_premade.deck_type, TRUE, p_premade_deck_id
  )
  RETURNING id INTO v_new_deck_id;

  WITH cloned AS (
    INSERT INTO cards (
      user_id, deck_id, premade_deck_id,
      layout_type, fields_data, card_type, jlpt_level, tags,
      status, due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps,
      reps, lapses, state, last_review
    )
    SELECT
      p_user_id, v_new_deck_id, NULL,
      c.layout_type, c.fields_data, c.card_type, c.jlpt_level, COALESCE(c.tags, '{}'),
      'new'::card_status, NOW(), 0, 0,
      0, 0, 0,
      0, 0, 0, NULL
    FROM cards c
    WHERE c.premade_deck_id = p_premade_deck_id
      AND c.user_id IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted_count FROM cloned;

  RETURN QUERY SELECT v_new_sub_id, v_new_deck_id, v_inserted_count, FALSE;
END;
$$;
