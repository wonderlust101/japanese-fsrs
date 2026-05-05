-- =============================================================
-- Migration: 20260507000003_subscribe_copy_embedding.sql
-- Severity: HIGH (closes audit C4 — premade clones get embeddings)
--
-- subscribe_to_premade_deck previously cloned source cards without
-- carrying c.embedding, so every forked card had embedding = NULL
-- and was excluded from find_similar_cards (which filters IS NOT NULL).
--
-- This migration recreates the function so the cloning SELECT also
-- carries embedding and embedding_updated_at. Once admin backfill
-- (POST /api/v1/admin/backfill-premade-embeddings) populates the
-- premade source rows, every new subscriber inherits the embedding
-- without paying the OpenAI cost individually.
--
-- The auth.uid() guard remains absent (per migration 20260507000000).
-- =============================================================

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
  v_premade            public.premade_decks%ROWTYPE;
  v_existing_sub_id    UUID;
  v_existing_deck_id   UUID;
  v_existing_count     INT;
  v_new_sub_id         UUID;
  v_new_deck_id        UUID;
  v_inserted_count     INT;
BEGIN
  SELECT * INTO v_premade
  FROM public.premade_decks
  WHERE id = p_premade_deck_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premade deck not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.id, d.id, d.card_count
    INTO v_existing_sub_id, v_existing_deck_id, v_existing_count
  FROM public.user_premade_subscriptions s
  JOIN public.decks d
    ON d.user_id           = s.user_id
   AND d.source_premade_id = s.premade_deck_id
   AND d.is_premade_fork   = TRUE
  WHERE s.user_id         = p_user_id
    AND s.premade_deck_id = p_premade_deck_id;

  IF v_existing_sub_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_sub_id, v_existing_deck_id, v_existing_count, TRUE;
    RETURN;
  END IF;

  INSERT INTO public.user_premade_subscriptions (user_id, premade_deck_id)
  VALUES (p_user_id, p_premade_deck_id)
  RETURNING id INTO v_new_sub_id;

  INSERT INTO public.decks (
    user_id, name, description, deck_type, is_premade_fork, source_premade_id
  )
  VALUES (
    p_user_id, v_premade.name, v_premade.description, v_premade.deck_type, TRUE, p_premade_deck_id
  )
  RETURNING id INTO v_new_deck_id;

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

  RETURN QUERY SELECT v_new_sub_id, v_new_deck_id, v_inserted_count, FALSE;
END;
$$;
