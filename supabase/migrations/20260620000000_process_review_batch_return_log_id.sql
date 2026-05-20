-- =============================================================
-- Migration: 20260620000000_process_review_batch_return_log_id.sql
--
-- Adds `review_log_id UUID` to the RETURNS TABLE signature of
-- process_review_batch so the service layer can propagate the
-- inserted log id back to the client. Mirrors the single-card
-- processReview() path, where the post-RPC follow-up SELECT
-- already captures the same value — for the batch path we
-- capture it directly via `RETURNING id INTO v_log_id`.
--
-- Why this is the cleanest fix:
--
--   * No second round-trip per batch row.
--   * Exactly-once: the log row is INSERTed and its id is read
--     inside the same statement, so it's free of any
--     `(card_id, reviewed_at)` ambiguity.
--   * The failure paths (card-not-found, source-card,
--     ownership-mismatch, generic exception) all emit NULL for
--     `review_log_id`, keeping the column shape stable.
--
-- The function body is copied wholesale from the prior
-- 20260615000000 rename migration; the only changes are:
--
--   1. `RETURNS TABLE(…, review_log_id UUID)` — appended.
--   2. New local `v_log_id UUID;` in the DECLARE block.
--   3. INSERT INTO public.review_logs (…) gains `RETURNING id INTO v_log_id`.
--   4. Every `RETURN NEXT` branch assigns `review_log_id`
--      (NULL on failure, `v_log_id` on success).
--
-- Postgres rejects `CREATE OR REPLACE` when the RETURNS TABLE shape
-- changes; we add `review_log_id UUID` to the row, so an explicit
-- DROP is required first. `IF EXISTS` makes the migration safe on
-- fresh databases (no function to drop) and on any environment where
-- the prior 20260615000000 rename had already created the old shape.
-- =============================================================


DROP FUNCTION IF EXISTS public.process_review_batch(UUID, JSONB, INT);

CREATE OR REPLACE FUNCTION process_review_batch(
  p_user_id          UUID,
  p_reviews          JSONB,
  p_leech_threshold  INT
)
RETURNS TABLE(
  card_id        UUID,
  success        BOOLEAN,
  error_message  TEXT,
  due            TIMESTAMPTZ,
  stability      FLOAT,
  difficulty     FLOAT,
  scheduled_days INT,
  state          INT,
  review_log_id  UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r            RECORD;
  v_card_owner UUID;
  v_log_id     UUID;
BEGIN
  FOR r IN
    SELECT *
    FROM jsonb_to_recordset(p_reviews) AS x(
      card_id                  UUID,
      rating                   public.review_rating,
      review_time_ms           INT,
      session_id               UUID,
      p_state                  INT,
      p_due                    TIMESTAMPTZ,
      p_stability              FLOAT,
      p_difficulty             FLOAT,
      p_elapsed_days           INT,
      p_scheduled_days         INT,
      p_learning_steps         INT,
      p_reps                   INT,
      p_lapses                 INT,
      p_last_review            TIMESTAMPTZ,
      p_state_before           INT,
      p_stability_before       FLOAT,
      p_difficulty_before      FLOAT,
      p_due_before             TIMESTAMPTZ,
      p_scheduled_days_before  INT,
      p_learning_steps_before  INT,
      p_elapsed_days_before    INT,
      p_last_review_before     TIMESTAMPTZ,
      p_reps_before            INT,
      p_lapses_before          INT
    )
  LOOP
    BEGIN
      v_log_id := NULL;

      SELECT user_id INTO v_card_owner
        FROM public.cards
       WHERE id = r.card_id
         FOR UPDATE;

      IF NOT FOUND THEN
        card_id        := r.card_id;
        success        := FALSE;
        error_message  := 'card_not_found';
        due            := NULL;
        stability      := NULL;
        difficulty     := NULL;
        scheduled_days := NULL;
        state          := NULL;
        review_log_id  := NULL;
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF v_card_owner IS NULL THEN
        card_id        := r.card_id;
        success        := FALSE;
        error_message  := 'cannot_review_source_card';
        due            := NULL;
        stability      := NULL;
        difficulty     := NULL;
        scheduled_days := NULL;
        state          := NULL;
        review_log_id  := NULL;
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF v_card_owner <> p_user_id THEN
        card_id        := r.card_id;
        success        := FALSE;
        error_message  := 'card_ownership_mismatch';
        due            := NULL;
        stability      := NULL;
        difficulty     := NULL;
        scheduled_days := NULL;
        state          := NULL;
        review_log_id  := NULL;
        RETURN NEXT;
        CONTINUE;
      END IF;

      UPDATE public.cards
      SET
        due            = r.p_due,
        stability      = r.p_stability,
        difficulty     = r.p_difficulty,
        elapsed_days   = r.p_elapsed_days,
        scheduled_days = r.p_scheduled_days,
        learning_steps = r.p_learning_steps,
        reps           = r.p_reps,
        lapses         = r.p_lapses,
        state          = r.p_state,
        last_review    = r.p_last_review,
        updated_at     = r.p_last_review
      WHERE id = r.card_id
        AND user_id = p_user_id;

      INSERT INTO public.review_logs (
        card_id, user_id, rating, review_time_ms,
        stability_after, difficulty_after, due_after, scheduled_days_after,
        state_before, stability_before, difficulty_before, due_before,
        scheduled_days_before, learning_steps_before, elapsed_days_before,
        last_review_before, reps_before, lapses_before, session_id
      ) VALUES (
        r.card_id, p_user_id, r.rating, r.review_time_ms,
        r.p_stability, r.p_difficulty, r.p_due, r.p_scheduled_days,
        r.p_state_before, r.p_stability_before, r.p_difficulty_before, r.p_due_before,
        r.p_scheduled_days_before, r.p_learning_steps_before, r.p_elapsed_days_before,
        r.p_last_review_before, r.p_reps_before, r.p_lapses_before, r.session_id
      )
      RETURNING id INTO v_log_id;

      IF r.p_lapses >= p_leech_threshold THEN
        INSERT INTO public.weak_spots (card_id, user_id, session_id)
        SELECT r.card_id, p_user_id, r.session_id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.weak_spots l
          WHERE l.card_id  = r.card_id
            AND l.user_id  = p_user_id
            AND l.resolved = FALSE
        );
      END IF;

      card_id        := r.card_id;
      success        := TRUE;
      error_message  := NULL;
      due            := r.p_due;
      stability      := r.p_stability;
      difficulty     := r.p_difficulty;
      scheduled_days := r.p_scheduled_days;
      state          := r.p_state;
      review_log_id  := v_log_id;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      card_id        := r.card_id;
      success        := FALSE;
      error_message  := SQLERRM;
      due            := NULL;
      stability      := NULL;
      difficulty     := NULL;
      scheduled_days := NULL;
      state          := NULL;
      review_log_id  := NULL;
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION process_review_batch(UUID, JSONB, INT) TO service_role;
