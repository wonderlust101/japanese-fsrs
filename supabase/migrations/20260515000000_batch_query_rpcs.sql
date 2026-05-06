-- =============================================================
-- Migration: 20260515000000_batch_query_rpcs.sql
--
-- Adds four read-/write-batching RPCs identified by the N+1 audit. All
-- additive — no existing functions are modified, so rollback is just
-- "stop calling the new RPC". Per CLAUDE.md migration conventions, each
-- new SECURITY DEFINER function gets an explicit GRANT EXECUTE.
--
--   A. process_review_batch — collapses N round-trips of process_review
--      into 1. The JS service still computes ts-fsrs scheduling per
--      review (ts-fsrs is a JS library); the post-schedule state is
--      packed into a JSONB array and submitted at once. Per-review
--      EXCEPTION blocks preserve the "collect errors, continue" contract
--      of the existing submitBatch.
--
--   B. get_dashboard_data — wraps the existing five analytics RPCs into
--      a single JSONB envelope so the analytics page makes one HTTP +
--      one DB round-trip instead of five.
--
--   C. get_due_cards — collapses 2 COUNTs + 2 SELECTs in getDueCards
--      into a single CTE-driven query. Returns overdue cards (ordered
--      by due ASC) followed by new cards (ordered by created_at ASC),
--      both capped by the user's daily limits.
--
--   D. bulk_update_card_embeddings — used only by the ops-only
--      backfillPremadeEmbeddings to flush all newly-computed embeddings
--      in one UPDATE instead of N. Deliberately skips search_path
--      hardening (matches find_similar_cards precedent — pgvector's
--      vector type may live in extensions schema).
-- =============================================================


-- ─── A. process_review_batch ──────────────────────────────────────────────────
-- Per-review structure mirrors the parameter shape of process_review except
-- that it travels as JSONB. Every iteration runs in its own subtransaction
-- (the BEGIN ... EXCEPTION block); failures roll back that iteration only.

CREATE FUNCTION process_review_batch(
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
  state          INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r            RECORD;
  v_card_owner UUID;
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
      -- Lock the row + ownership check (same pattern as process_review).
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
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Persist FSRS state.
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

      -- Append review log.
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
      );

      -- Leech detection (skip if an unresolved leech already exists).
      IF r.p_lapses >= p_leech_threshold THEN
        INSERT INTO public.leeches (card_id, user_id, session_id)
        SELECT r.card_id, p_user_id, r.session_id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.leeches l
          WHERE l.card_id  = r.card_id
            AND l.user_id  = p_user_id
            AND l.resolved = FALSE
        );
      END IF;

      -- Success row.
      card_id        := r.card_id;
      success        := TRUE;
      error_message  := NULL;
      due            := r.p_due;
      stability      := r.p_stability;
      difficulty     := r.p_difficulty;
      scheduled_days := r.p_scheduled_days;
      state          := r.p_state;
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
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION process_review_batch(UUID, JSONB, INT) TO service_role;


-- ─── B. get_dashboard_data ────────────────────────────────────────────────────
-- Bundles the five existing analytics RPCs into a single JSONB envelope.
-- The wrapped functions are themselves SECURITY DEFINER + parameter-scoped
-- to p_user_id, so the wrapper is a pure aggregation step.

CREATE FUNCTION get_dashboard_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'heatmap', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'date',      h.date,
         'retention', h.retention,
         'count',     h.count
       ))
       FROM public.get_heatmap_data(p_user_id) AS h),
      '[]'::jsonb
    ),
    'accuracy', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'layout',     a.layout,
         'total',      a.total,
         'successful', a.successful
       ))
       FROM public.get_accuracy_by_layout(p_user_id) AS a),
      '[]'::jsonb
    ),
    'streak', (
      SELECT jsonb_build_object(
        'current_streak',   s.current_streak,
        'longest_streak',   s.longest_streak,
        'last_review_date', s.last_review_date
      )
      FROM public.get_streak(p_user_id) AS s
      LIMIT 1
    ),
    'jlpt_gap', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'jlpt_level', g.jlpt_level,
         'total',      g.total,
         'learned',    g.learned,
         'due',        g.due
       ))
       FROM public.get_jlpt_gap(p_user_id) AS g),
      '[]'::jsonb
    ),
    'milestones', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'jlpt_level',                m.jlpt_level,
         'total',                     m.total,
         'learned',                   m.learned,
         'daily_pace',                m.daily_pace,
         'days_remaining',            m.days_remaining,
         'projected_completion_date', m.projected_completion_date
       ))
       FROM public.get_milestone_forecast(p_user_id) AS m),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_data(UUID) TO service_role;


-- ─── C. get_due_cards ─────────────────────────────────────────────────────────
-- One query replaces the 4 round-trips currently issued by getDueCards
-- (today's-total count, today's-new count, overdue select, new select).

CREATE FUNCTION get_due_cards(
  p_user_id               UUID,
  p_daily_review_limit    INT,
  p_daily_new_cards_limit INT
)
RETURNS TABLE(
  id          UUID,
  deck_id     UUID,
  card_type   public.card_type,
  jlpt_level  public.jlpt_level,
  state       INT,
  due         TIMESTAMPTZ,
  fields_data JSONB,
  layout_type public.layout_type
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH today_bound AS (
    SELECT DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS lo
  ),
  counts AS (
    SELECT
      COUNT(*)                                                       AS total_today,
      COUNT(*) FILTER (WHERE rl.state_before = 0)                    AS new_today
    FROM public.review_logs rl, today_bound t
    WHERE rl.user_id = p_user_id
      AND rl.reviewed_at >= t.lo
  ),
  caps AS (
    SELECT
      GREATEST(0, p_daily_review_limit    - total_today)::INT AS remaining_total,
      GREATEST(0, p_daily_new_cards_limit - new_today)::INT   AS remaining_new
    FROM counts
  ),
  overdue AS (
    SELECT
      c.id, c.deck_id, c.card_type, c.jlpt_level,
      c.state, c.due, c.fields_data, c.layout_type,
      0 AS sort_bucket
    FROM public.cards c, caps
    WHERE c.user_id      = p_user_id
      AND c.state        IN (1, 2, 3)            -- Learning, Review, Relearning
      AND c.is_suspended = FALSE
      AND c.due         <= NOW()
      AND caps.remaining_total > 0
    ORDER BY c.due ASC
    LIMIT (SELECT remaining_total FROM caps)
  ),
  new_slots AS (
    SELECT
      GREATEST(
        0,
        LEAST(
          (SELECT remaining_new FROM caps),
          (SELECT remaining_total FROM caps) - (SELECT COUNT(*)::INT FROM overdue)
        )
      ) AS n
  ),
  news AS (
    SELECT
      c.id, c.deck_id, c.card_type, c.jlpt_level,
      c.state, c.due, c.fields_data, c.layout_type,
      1 AS sort_bucket
    FROM public.cards c, new_slots
    WHERE c.user_id      = p_user_id
      AND c.state        = 0
      AND c.is_suspended = FALSE
      AND new_slots.n > 0
    ORDER BY c.created_at ASC
    LIMIT (SELECT n FROM new_slots)
  )
  SELECT id, deck_id, card_type, jlpt_level, state, due, fields_data, layout_type
  FROM (
    SELECT * FROM overdue
    UNION ALL
    SELECT * FROM news
  ) ordered
  ORDER BY sort_bucket, due;
$$;

GRANT EXECUTE ON FUNCTION get_due_cards(UUID, INT, INT) TO service_role;


-- ─── D. bulk_update_card_embeddings ───────────────────────────────────────────
-- Ops-only path used by backfillPremadeEmbeddings. Skips SET search_path
-- because the `vector` type from pgvector is installed into whichever
-- schema CREATE EXTENSION put it in (typically `extensions` on Supabase),
-- and pinning search_path to '' would hide the type and the cast would
-- fail with "type vector does not exist". Same precedent as
-- find_similar_cards.

CREATE FUNCTION bulk_update_card_embeddings(p_updates JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH updated AS (
    UPDATE cards c
    SET embedding            = u.embedding::vector,
        embedding_updated_at = NOW()
    FROM jsonb_to_recordset(p_updates) AS u(id UUID, embedding TEXT)
    WHERE c.id = u.id
    RETURNING c.id
  )
  SELECT COUNT(*)::INT INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_update_card_embeddings(JSONB) TO service_role;
