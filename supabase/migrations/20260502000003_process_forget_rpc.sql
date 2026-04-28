-- Adds the process_forget() RPC used by fsrs.service.ts forgetCard().
--
-- Atomically resets a card to New state and writes a 'manual' review log.
-- Uses the 'manual' review_rating value added in migration 20260502000000.
-- No leech check — forget is an intentional user action, not a failure.

CREATE OR REPLACE FUNCTION process_forget(
  -- Card identity
  p_card_id              UUID,
  p_user_id              UUID,

  -- New card state after forget (New state defaults)
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_scheduled_days       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_updated_at           TIMESTAMPTZ,

  -- Before-snapshot (always populated by forgetCard() — never null)
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
SET search_path = public
AS $$
BEGIN
  -- 1. Reset card to New state.
  --    learning_steps and elapsed_days always reset to 0 on forget.
  --    last_review is cleared — the card starts fresh.
  UPDATE cards
  SET
    status         = 'new',
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

  -- 2. Write an immutable 'manual' log entry with the full before-snapshot.
  --    This preserves an audit trail and allows rollback of the forget operation.
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
    'manual',
    NULL,
    p_stability,
    p_difficulty,
    p_due,
    p_scheduled_days,
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
END;
$$;
