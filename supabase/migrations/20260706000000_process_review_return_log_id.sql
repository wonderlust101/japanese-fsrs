-- ─────────────────────────────────────────────────────────────────────────────
-- Makes process_review (single-card path) RETURN the inserted review_logs id,
-- mirroring process_review_batch (migration 20260620000000).
--
-- WHY:
--   The TS service used to re-find the just-written log with a follow-up
--   SELECT filtered on `reviewed_at`. But process_review never received the
--   JS-computed timestamp — review_logs.reviewed_at defaults to the DB clock —
--   so the exact-match filter never matched and the lookup returned NULL.
--   The summary page's per-card rollback affordance was therefore dead after
--   a single review. Capturing the id with `RETURNING id INTO v_log_id` inside
--   the same INSERT is exactly-once and free of the (card_id, reviewed_at)
--   ambiguity, and removes the extra round-trip.
--
-- Postgres rejects CREATE OR REPLACE when the RETURN type changes (VOID → UUID),
-- so an explicit DROP is required first. IF EXISTS keeps the migration safe on
-- a fresh database. The argument-type list below must match the existing
-- signature exactly (defaults are not part of the function identity).
--
-- Body is a verbatim copy of 20260625000000_archive_check_in_process_review.sql
-- with exactly three additions:
--   1. RETURNS UUID (was VOID).
--   2. New local `v_log_id UUID;` in the DECLARE block.
--   3. INSERT INTO public.review_logs (…) gains `RETURNING id INTO v_log_id`,
--      and the function ends with `RETURN v_log_id;`.
-- Diff the two files to verify no other drift.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.process_review(
  UUID, UUID, INT, TIMESTAMPTZ, FLOAT, FLOAT, INT, INT, INT, INT, INT,
  TIMESTAMPTZ, TIMESTAMPTZ, review_rating, INT, FLOAT, FLOAT, TIMESTAMPTZ,
  INT, INT, INT, FLOAT, FLOAT, TIMESTAMPTZ, INT, INT, INT, TIMESTAMPTZ,
  INT, INT, UUID
);

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
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card_owner UUID;
  v_log_id     UUID;
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

  -- Archive gate (20260625000000): reject reviews on cards whose deck is
  -- archived. Custom SQLSTATE 'P0420' → TS maps to 422 DECK_ARCHIVED.
  IF EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.decks d ON d.id = c.deck_id
    WHERE c.id = p_card_id
      AND d.archived_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'deck_archived'
      USING ERRCODE = 'P0420',
            HINT    = 'The deck containing this card is archived. Unarchive it before reviewing.';
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
  )
  RETURNING id INTO v_log_id;

  IF p_lapses >= p_leech_threshold THEN
    INSERT INTO public.weak_spots (card_id, user_id, session_id)
    SELECT p_card_id, p_user_id, p_session_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM   public.weak_spots l
      WHERE  l.card_id  = p_card_id
        AND  l.user_id  = p_user_id
        AND  l.resolved = FALSE
    );
  END IF;

  RETURN v_log_id;
END;
$$;

-- Re-grant execute (DROP removed the prior grant). Signature unchanged from
-- 20260625000000 except the return type, which is not part of the arg list.
GRANT EXECUTE ON FUNCTION public.process_review(
  UUID, UUID, INT, TIMESTAMPTZ, FLOAT, FLOAT, INT, INT, INT, INT, INT,
  TIMESTAMPTZ, TIMESTAMPTZ, review_rating, INT, FLOAT, FLOAT, TIMESTAMPTZ,
  INT, INT, INT, FLOAT, FLOAT, TIMESTAMPTZ, INT, INT, INT, TIMESTAMPTZ,
  INT, INT, UUID
) TO service_role;
