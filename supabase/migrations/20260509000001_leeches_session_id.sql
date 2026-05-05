-- =============================================================
-- Migration: 20260509000001_leeches_session_id.sql
-- Severity: LOW — fragile heuristic removal
--
-- getSessionSummary() previously matched leeches to a session
-- using a time-window heuristic (reviewed_at within ±5 seconds of
-- the leech's created_at). That heuristic broke under clock skew,
-- batch submissions, or any review processed at the boundary of
-- the window.
--
-- Add session_id directly to leeches and have process_review write
-- it alongside card_id/user_id when a leech is created. The service
-- layer then performs an exact match instead of a fuzzy JOIN.
--
-- The column is nullable so pre-existing leeches don't need a
-- backfill — they just won't appear in any session summary, which
-- is acceptable since the prior heuristic was already unreliable
-- for them.
-- =============================================================

ALTER TABLE leeches ADD COLUMN session_id UUID;

CREATE INDEX leeches_session_id_idx
  ON leeches(session_id)
  WHERE session_id IS NOT NULL;


-- Recreate process_review to pass session_id into the leech INSERT.
-- Body is identical to 20260507000000's version except for the leech block.
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
  SELECT user_id INTO v_card_owner
    FROM public.cards
   WHERE id = p_card_id;

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

  -- 1. Persist updated FSRS scheduling state on the card.
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

  -- 2. Append an immutable review log entry with optional before-snapshot.
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

  -- 3. Leech detection — insert only when threshold crossed and no unresolved
  --    leech already exists for this (card, user) pair. session_id is
  --    written so getSessionSummary can match leeches to sessions exactly.
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
