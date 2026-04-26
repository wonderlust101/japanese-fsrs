-- ============================================================
-- process_review() RPC
--
-- Wraps the three writes that every review produces into a single
-- PostgreSQL transaction. Calling this via supabase.rpc() guarantees
-- that FSRS state, the review log, and leech detection are atomic:
-- if any statement fails the entire review rolls back.
--
-- Called exclusively by fsrs.service.ts processReview().
-- ============================================================

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
  p_review_time_ms       INT,            -- nullable: client may not report time-on-card
  p_stability_after      FLOAT,
  p_difficulty_after     FLOAT,
  p_due_after            TIMESTAMPTZ,
  p_scheduled_days_after INT,

  -- Leech threshold (read from env in the service layer, passed here)
  p_leech_threshold      INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Persist updated FSRS scheduling state on the card.
  --    user_id guard is defense-in-depth: the TypeScript service already verified
  --    ownership, but this prevents any cross-user write if that check is bypassed.
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

  -- 2. Append an immutable review log entry.
  INSERT INTO review_logs (
    card_id,
    user_id,
    rating,
    review_time_ms,
    stability_after,
    difficulty_after,
    due_after,
    scheduled_days_after
  ) VALUES (
    p_card_id,
    p_user_id,
    p_rating,
    p_review_time_ms,
    p_stability_after,
    p_difficulty_after,
    p_due_after,
    p_scheduled_days_after
  );

  -- 3. Leech detection — insert only when the threshold is crossed and no
  --    unresolved leech already exists for this (card, user) pair.
  --    The partial unique index on leeches(card_id, user_id) WHERE resolved = FALSE
  --    is defense-in-depth against duplicates at the DB layer.
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
