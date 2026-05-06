-- =============================================================
-- Migration: 20260514000000_atomic_service_writes.sql
--
-- Closes broken-invariant risks identified in the transaction-boundary
-- audit by moving the remaining multi-write code paths into PL/pgSQL
-- RPCs (each one runs in an implicit transaction) and adding row locks
-- where read-modify-write was racy.
--
--   A. update_card_with_sibling_sync — atomic target UPDATE + sibling
--      sync of the shared fields {word, reading, meaning}. Replaces the
--      JS-side syncSharedFields() helper that had a documented partial-
--      failure window.
--
--   B. update_profile_with_interests — atomic profile UPDATE + interests
--      replace. Closes the silent-wipe-of-interests scenario in the JS
--      replaceInterests() DELETE-then-INSERT helper.
--
--   C. unsubscribe_from_premade_deck — atomic deck DELETE + subscription
--      DELETE. Closes the ghost-subscription state when the second
--      DELETE was failing post-cascade.
--
--   D. process_review — adds SELECT … FOR UPDATE to the ownership read
--      so concurrent reviews of the same card serialize at the row
--      level. Body otherwise identical to 20260509000001.
--
--   E. process_forget — same row lock as D. Body otherwise identical
--      to 20260507000000.
--
-- All new functions follow the project conventions: SECURITY DEFINER,
-- SET search_path = '', fully qualified public.* references, explicit
-- GRANT EXECUTE TO service_role.
-- =============================================================


-- ─── A. update_card_with_sibling_sync ─────────────────────────────────────────
-- Replaces apps/api/src/services/card.service.ts → updateCard + syncSharedFields.
-- Sibling sync only fires when fields_data is patched and contains at least one
-- of the shared keys (word, reading, meaning). Other patch fields (layout_type,
-- card_type, tags, jlpt_level) update only the target row.

CREATE FUNCTION update_card_with_sibling_sync(
  p_card_id     UUID,
  p_user_id     UUID,
  p_fields_data JSONB        DEFAULT NULL,
  p_layout_type layout_type  DEFAULT NULL,
  p_card_type   card_type    DEFAULT NULL,
  p_tags        TEXT[]       DEFAULT NULL,
  p_jlpt_level  jlpt_level   DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_root_id       UUID;
  v_shared_fields JSONB := '{}'::jsonb;
BEGIN
  -- Lock the target row + ownership check in one shot. Premade source cards
  -- (user_id IS NULL) are excluded by the user_id equality.
  PERFORM 1
    FROM public.cards
   WHERE id = p_card_id
     AND user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified card does not exist or does not belong to this user.';
  END IF;

  -- Apply the patch. COALESCE keeps existing values when a param is NULL,
  -- preserving partial-update semantics from the JS layer.
  UPDATE public.cards SET
    fields_data = COALESCE(p_fields_data, fields_data),
    layout_type = COALESCE(p_layout_type, layout_type),
    card_type   = COALESCE(p_card_type,   card_type),
    tags        = COALESCE(p_tags,        tags),
    jlpt_level  = COALESCE(p_jlpt_level,  jlpt_level),
    updated_at  = NOW()
  WHERE id = p_card_id
    AND user_id = p_user_id;

  -- Sibling sync only runs when fields_data was actually patched.
  IF p_fields_data IS NOT NULL THEN
    SELECT COALESCE(parent_card_id, id)
      INTO v_root_id
      FROM public.cards
     WHERE id = p_card_id;

    IF p_fields_data ? 'word' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('word', p_fields_data->'word');
    END IF;
    IF p_fields_data ? 'reading' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('reading', p_fields_data->'reading');
    END IF;
    IF p_fields_data ? 'meaning' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('meaning', p_fields_data->'meaning');
    END IF;

    IF v_shared_fields <> '{}'::jsonb THEN
      UPDATE public.cards
         SET fields_data = fields_data || v_shared_fields,
             updated_at  = NOW()
       WHERE user_id = p_user_id
         AND id != p_card_id
         AND (parent_card_id = v_root_id OR id = v_root_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_card_with_sibling_sync(
  UUID, UUID, JSONB, layout_type, card_type, TEXT[], jlpt_level
) TO service_role;


-- ─── B. update_profile_with_interests ─────────────────────────────────────────
-- Replaces apps/api/src/services/profile.service.ts → updateProfile + replaceInterests.
-- p_interests = NULL leaves the user_interests rows untouched; p_interests = '{}'
-- (empty array) clears the set; p_interests = ARRAY[...] replaces the set.

CREATE FUNCTION update_profile_with_interests(
  p_user_id   UUID,
  p_patch     JSONB,
  p_interests TEXT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles SET
    jlpt_target           = COALESCE(NULLIF(p_patch->>'jlpt_target', '')::jlpt_level, jlpt_target),
    study_goal            = COALESCE(p_patch->>'study_goal',                          study_goal),
    daily_new_cards_limit = COALESCE((p_patch->>'daily_new_cards_limit')::INT,        daily_new_cards_limit),
    daily_review_limit    = COALESCE((p_patch->>'daily_review_limit')::INT,           daily_review_limit),
    retention_target      = COALESCE((p_patch->>'retention_target')::FLOAT,           retention_target),
    timezone              = COALESCE(p_patch->>'timezone',                            timezone),
    native_language       = COALESCE(p_patch->>'native_language',                     native_language),
    updated_at            = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified profile does not exist.';
  END IF;

  IF p_interests IS NOT NULL THEN
    DELETE FROM public.user_interests WHERE user_id = p_user_id;

    IF array_length(p_interests, 1) > 0 THEN
      INSERT INTO public.user_interests (user_id, interest)
      SELECT DISTINCT p_user_id, unnested
        FROM unnest(p_interests) AS unnested
       WHERE unnested IS NOT NULL AND unnested <> ''
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_profile_with_interests(UUID, JSONB, TEXT[]) TO service_role;


-- ─── C. unsubscribe_from_premade_deck ─────────────────────────────────────────
-- Replaces apps/api/src/services/premade.service.ts → unsubscribeFromPremadeDeck.
-- Deck delete cascades to user-owned cards (FK ON DELETE CASCADE on cards.deck_id).
-- Idempotent: returns silently if neither row exists.

CREATE FUNCTION unsubscribe_from_premade_deck(
  p_user_id         UUID,
  p_premade_deck_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.decks
   WHERE user_id           = p_user_id
     AND source_premade_id = p_premade_deck_id
     AND is_premade_fork   = TRUE;

  DELETE FROM public.user_premade_subscriptions
   WHERE user_id         = p_user_id
     AND premade_deck_id = p_premade_deck_id;
END;
$$;

GRANT EXECUTE ON FUNCTION unsubscribe_from_premade_deck(UUID, UUID) TO service_role;


-- ─── D. process_review — add row lock ─────────────────────────────────────────
-- Body identical to 20260509000001 except the ownership SELECT uses FOR UPDATE
-- so the row is locked for the rest of the function's transaction. Concurrent
-- reviews of the same card now serialize cleanly instead of racing on the
-- read-modify-write between the JS-side fetch and this RPC.

CREATE OR REPLACE FUNCTION process_review(
  p_card_id              UUID,
  p_user_id              UUID,
  p_state                INT,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_elapsed_days         INT,
  p_scheduled_days       INT,
  p_learning_steps       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_last_review          TIMESTAMPTZ,
  p_updated_at           TIMESTAMPTZ,
  p_rating               review_rating,
  p_review_time_ms       INT,
  p_stability_after      FLOAT,
  p_difficulty_after     FLOAT,
  p_due_after            TIMESTAMPTZ,
  p_scheduled_days_after INT,
  p_leech_threshold      INT,
  p_state_before          INT         DEFAULT NULL,
  p_stability_before      FLOAT       DEFAULT NULL,
  p_difficulty_before     FLOAT       DEFAULT NULL,
  p_due_before            TIMESTAMPTZ DEFAULT NULL,
  p_scheduled_days_before INT         DEFAULT NULL,
  p_learning_steps_before INT         DEFAULT NULL,
  p_elapsed_days_before   INT         DEFAULT NULL,
  p_last_review_before    TIMESTAMPTZ DEFAULT NULL,
  p_reps_before           INT         DEFAULT NULL,
  p_lapses_before         INT         DEFAULT NULL,
  p_session_id            UUID        DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card_owner UUID;
BEGIN
  -- Lock the row for the duration of this function. Concurrent process_review
  -- calls for the same card_id will block here until the first commits.
  SELECT user_id INTO v_card_owner
    FROM public.cards
   WHERE id = p_card_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified card does not exist.';
  END IF;

  IF v_card_owner IS NULL THEN
    RAISE EXCEPTION 'cannot_review_source_card'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'Submit reviews against your personal copy of this card, not the premade source.';
  END IF;

  IF v_card_owner != p_user_id THEN
    RAISE EXCEPTION 'card_ownership_mismatch'
      USING ERRCODE = 'insufficient_privilege',
            HINT    = 'The specified card does not belong to this user.';
  END IF;

  UPDATE public.cards
  SET
    due            = p_due,
    stability      = p_stability,
    difficulty     = p_difficulty,
    elapsed_days   = p_elapsed_days,
    scheduled_days = p_scheduled_days,
    learning_steps = p_learning_steps,
    reps           = p_reps,
    lapses         = p_lapses,
    state          = p_state,
    last_review    = p_last_review,
    updated_at     = p_updated_at
  WHERE id = p_card_id
    AND user_id = p_user_id;

  INSERT INTO public.review_logs (
    card_id, user_id, rating, review_time_ms,
    stability_after, difficulty_after, due_after, scheduled_days_after,
    state_before, stability_before, difficulty_before, due_before,
    scheduled_days_before, learning_steps_before, elapsed_days_before,
    last_review_before, reps_before, lapses_before, session_id
  ) VALUES (
    p_card_id, p_user_id, p_rating, p_review_time_ms,
    p_stability_after, p_difficulty_after, p_due_after, p_scheduled_days_after,
    p_state_before, p_stability_before, p_difficulty_before, p_due_before,
    p_scheduled_days_before, p_learning_steps_before, p_elapsed_days_before,
    p_last_review_before, p_reps_before, p_lapses_before, p_session_id
  );

  IF p_lapses >= p_leech_threshold THEN
    INSERT INTO public.leeches (card_id, user_id, session_id)
    SELECT p_card_id, p_user_id, p_session_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM   public.leeches l
      WHERE  l.card_id  = p_card_id
        AND  l.user_id  = p_user_id
        AND  l.resolved = FALSE
    );
  END IF;
END;
$$;


-- ─── E. process_forget — add row lock ─────────────────────────────────────────
-- Body identical to 20260507000000 except ownership SELECT uses FOR UPDATE.

CREATE OR REPLACE FUNCTION process_forget(
  p_card_id              UUID,
  p_user_id              UUID,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_scheduled_days       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_updated_at           TIMESTAMPTZ,
  p_state_before          INT,
  p_stability_before      FLOAT,
  p_difficulty_before     FLOAT,
  p_due_before            TIMESTAMPTZ,
  p_scheduled_days_before INT,
  p_learning_steps_before INT,
  p_elapsed_days_before   INT,
  p_last_review_before    TIMESTAMPTZ,
  p_reps_before           INT,
  p_lapses_before         INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card_owner UUID;
BEGIN
  SELECT user_id INTO v_card_owner
    FROM public.cards
   WHERE id = p_card_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_card_owner IS NULL THEN
    RAISE EXCEPTION 'cannot_forget_source_card'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'Forget your personal copy of this card, not the premade source.';
  END IF;

  IF v_card_owner != p_user_id THEN
    RAISE EXCEPTION 'card_ownership_mismatch'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.cards
  SET
    due            = p_due,
    stability      = p_stability,
    difficulty     = p_difficulty,
    elapsed_days   = 0,
    scheduled_days = p_scheduled_days,
    learning_steps = 0,
    reps           = p_reps,
    lapses         = p_lapses,
    state          = 0,
    last_review    = NULL,
    updated_at     = p_updated_at
  WHERE id = p_card_id
    AND user_id = p_user_id;

  INSERT INTO public.review_logs (
    card_id, user_id, rating,
    stability_after, difficulty_after, due_after, scheduled_days_after,
    state_before, stability_before, difficulty_before, due_before,
    scheduled_days_before, learning_steps_before, elapsed_days_before,
    last_review_before, reps_before, lapses_before
  ) VALUES (
    p_card_id, p_user_id, 'manual',
    p_stability, p_difficulty, p_due, p_scheduled_days,
    p_state_before, p_stability_before, p_difficulty_before, p_due_before,
    p_scheduled_days_before, p_learning_steps_before, p_elapsed_days_before,
    p_last_review_before, p_reps_before, p_lapses_before
  );
END;
$$;
