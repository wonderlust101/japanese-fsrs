-- Updates process_review() to also write before-snapshot columns into review_logs.
--
-- The 10 new parameters all DEFAULT NULL so existing callers continue to work
-- unchanged. New callers (fsrs.service.ts processReview / rescheduleFromHistory)
-- supply the before-snapshot values to enable future rollback operations.
--
-- The comment "computed by ts-fsrs" replaces the old "computed by binding" note.

CREATE OR REPLACE FUNCTION process_review(
  -- Card identity
  p_card_id              UUID,
  p_user_id              UUID,

  -- New FSRS state (computed by ts-fsrs in TypeScript)
  p_status               card_status,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_elapsed_days         INT,
  p_scheduled_days       INT,
  p_learning_steps       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_state                INT,
  p_last_review          TIMESTAMPTZ,
  p_updated_at           TIMESTAMPTZ,

  -- Review log fields
  p_rating               review_rating,
  p_review_time_ms       INT,
  p_stability_after      FLOAT,
  p_difficulty_after     FLOAT,
  p_due_after            TIMESTAMPTZ,
  p_scheduled_days_after INT,

  -- Leech threshold
  p_leech_threshold      INT,

  -- Before-snapshot (DEFAULT NULL — backward-compatible; populated by new callers)
  p_state_before          INT         DEFAULT NULL,
  p_stability_before      FLOAT       DEFAULT NULL,
  p_difficulty_before     FLOAT       DEFAULT NULL,
  p_due_before            TIMESTAMPTZ DEFAULT NULL,
  p_scheduled_days_before INT         DEFAULT NULL,
  p_learning_steps_before INT         DEFAULT NULL,
  p_elapsed_days_before   INT         DEFAULT NULL,
  p_last_review_before    TIMESTAMPTZ DEFAULT NULL,
  p_reps_before           INT         DEFAULT NULL,
  p_lapses_before         INT         DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Persist updated FSRS scheduling state on the card.
  UPDATE cards
  SET
    status         = p_status,
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
  INSERT INTO review_logs (
    card_id,
    user_id,
    rating,
    review_time_ms,
    stability_after,
    difficulty_after,
    due_after,
    scheduled_days_after,
    state_before,
    stability_before,
    difficulty_before,
    due_before,
    scheduled_days_before,
    learning_steps_before,
    elapsed_days_before,
    last_review_before,
    reps_before,
    lapses_before
  ) VALUES (
    p_card_id,
    p_user_id,
    p_rating,
    p_review_time_ms,
    p_stability_after,
    p_difficulty_after,
    p_due_after,
    p_scheduled_days_after,
    p_state_before,
    p_stability_before,
    p_difficulty_before,
    p_due_before,
    p_scheduled_days_before,
    p_learning_steps_before,
    p_elapsed_days_before,
    p_last_review_before,
    p_reps_before,
    p_lapses_before
  );

  -- 3. Leech detection — insert only when threshold is crossed and no
  --    unresolved leech already exists for this (card, user) pair.
  IF p_lapses >= p_leech_threshold THEN
    INSERT INTO leeches (card_id, user_id)
    SELECT p_card_id, p_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM   leeches l
      WHERE  l.card_id  = p_card_id
        AND  l.user_id  = p_user_id
        AND  l.resolved = FALSE
    );
  END IF;
END;
$$;
