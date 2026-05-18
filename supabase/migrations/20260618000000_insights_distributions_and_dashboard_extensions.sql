-- =============================================================
-- Migration: 20260618000000_insights_distributions_and_dashboard_extensions.sql
--
-- Two halves:
--
--   A. Five new RPCs that power the Statistics + Progress pages:
--      - get_answer_rating_distribution — again/hard/good/easy histogram
--      - get_interval_distribution       — bucketed cards.scheduled_days
--      - get_stability_distribution      — bucketed cards.stability
--      - get_difficulty_distribution     — bucketed cards.difficulty
--      - get_cards_added_this_month      — tz-aware month-to-date count
--
--   B. Cleanup + extension of the existing analytics surface:
--
--      The pre-existing migration history left two overloads of
--      `get_heatmap_data` and `get_dashboard_data` (the (UUID) signature
--      created by 20260604/20260614 lives alongside the (UUID, TEXT)
--      signature from 20260529). The (UUID, TEXT) variant's body still
--      references the now-dropped `get_accuracy_by_layout`. We
--      consolidate both functions to a single (UUID, TEXT DEFAULT 'UTC')
--      signature with the post-20260614 body and the new fields.
--
--      Wire-additive changes:
--      - Each heatmap row carries `total_seconds` so the Statistics
--        page can drop its 18-second heuristic.
--      - The dashboard envelope carries `cards_added_this_month` so the
--        Progress page can drop its hardcoded zero.
--
-- Premade source cards (cards.user_id IS NULL) are excluded from every
-- distribution — the user-scoped WHERE clauses skip them.
--
-- Bucket boundaries are server-defined and stable on the wire (labels
-- are TEXT) so the frontend can render the histograms without
-- re-deriving boundaries.
-- =============================================================


-- ─── A. New distribution RPCs ────────────────────────────────────────────────

-- A.1 — get_answer_rating_distribution
-- Always emits four rows (again, hard, good, easy) even when zero, via
-- the LATERAL VALUES unpivot pattern from get_card_quality_issues.

CREATE FUNCTION public.get_answer_rating_distribution(
  p_user_id UUID
)
RETURNS TABLE (rating TEXT, count INT)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT
      COUNT(*) FILTER (WHERE rl.rating = 'again')::INT AS again_count,
      COUNT(*) FILTER (WHERE rl.rating = 'hard')::INT  AS hard_count,
      COUNT(*) FILTER (WHERE rl.rating = 'good')::INT  AS good_count,
      COUNT(*) FILTER (WHERE rl.rating = 'easy')::INT  AS easy_count
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      -- Exclude the `'manual'` system rating used by forget/rollback;
      -- it's never a learner answer-button press.
      AND rl.rating <> 'manual'
  )
  SELECT v.rating, v.count
  FROM counts c,
  LATERAL (VALUES
    ('again'::TEXT, c.again_count),
    ('hard'::TEXT,  c.hard_count),
    ('good'::TEXT,  c.good_count),
    ('easy'::TEXT,  c.easy_count)
  ) AS v(rating, count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_answer_rating_distribution(UUID) TO service_role;


-- A.2 — get_interval_distribution
-- Seven buckets over cards.scheduled_days. State-filtered to Review (2)
-- + Relearning (3) — New (0) and Learning (1) cards have meaningless
-- scheduled_days (sub-day learning steps).

CREATE FUNCTION public.get_interval_distribution(
  p_user_id UUID
)
RETURNS TABLE (bucket TEXT, sort_key INT, count INT)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT
      COUNT(*) FILTER (WHERE c.scheduled_days <= 1)              ::INT AS b_1d,
      COUNT(*) FILTER (WHERE c.scheduled_days BETWEEN 2 AND 3)   ::INT AS b_2_3d,
      COUNT(*) FILTER (WHERE c.scheduled_days BETWEEN 4 AND 7)   ::INT AS b_4_7d,
      COUNT(*) FILTER (WHERE c.scheduled_days BETWEEN 8 AND 21)  ::INT AS b_8_21d,
      COUNT(*) FILTER (WHERE c.scheduled_days BETWEEN 22 AND 90) ::INT AS b_1_3mo,
      COUNT(*) FILTER (WHERE c.scheduled_days BETWEEN 91 AND 180)::INT AS b_3_6mo,
      COUNT(*) FILTER (WHERE c.scheduled_days > 180)             ::INT AS b_6mo_plus
    FROM public.cards c
    WHERE c.user_id = p_user_id
      AND c.state IN (2, 3)
      AND c.is_suspended = FALSE
  )
  SELECT v.bucket, v.sort_key, v.count
  FROM counts c,
  LATERAL (VALUES
    ('1d'::TEXT,    1, c.b_1d),
    ('2-3d'::TEXT,  2, c.b_2_3d),
    ('4-7d'::TEXT,  3, c.b_4_7d),
    ('8-21d'::TEXT, 4, c.b_8_21d),
    ('1-3mo'::TEXT, 5, c.b_1_3mo),
    ('3-6mo'::TEXT, 6, c.b_3_6mo),
    ('6mo+'::TEXT,  7, c.b_6mo_plus)
  ) AS v(bucket, sort_key, count)
  ORDER BY v.sort_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_interval_distribution(UUID) TO service_role;


-- A.3 — get_stability_distribution
-- Six buckets over cards.stability (FLOAT, days). Same state filter as
-- the interval RPC; stability is meaningless for New/Learning rows.

CREATE FUNCTION public.get_stability_distribution(
  p_user_id UUID
)
RETURNS TABLE (bucket TEXT, sort_key INT, count INT)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT
      COUNT(*) FILTER (WHERE c.stability <= 7)                        ::INT AS b_0_7d,
      COUNT(*) FILTER (WHERE c.stability > 7   AND c.stability <= 30) ::INT AS b_7_30d,
      COUNT(*) FILTER (WHERE c.stability > 30  AND c.stability <= 90) ::INT AS b_1_3mo,
      COUNT(*) FILTER (WHERE c.stability > 90  AND c.stability <= 180)::INT AS b_3_6mo,
      COUNT(*) FILTER (WHERE c.stability > 180 AND c.stability <= 365)::INT AS b_6_12mo,
      COUNT(*) FILTER (WHERE c.stability > 365)                       ::INT AS b_1y_plus
    FROM public.cards c
    WHERE c.user_id = p_user_id
      AND c.state IN (2, 3)
      AND c.is_suspended = FALSE
  )
  SELECT v.bucket, v.sort_key, v.count
  FROM counts c,
  LATERAL (VALUES
    ('0-7d'::TEXT,   1, c.b_0_7d),
    ('7-30d'::TEXT,  2, c.b_7_30d),
    ('1-3mo'::TEXT,  3, c.b_1_3mo),
    ('3-6mo'::TEXT,  4, c.b_3_6mo),
    ('6-12mo'::TEXT, 5, c.b_6_12mo),
    ('1y+'::TEXT,    6, c.b_1y_plus)
  ) AS v(bucket, sort_key, count)
  ORDER BY v.sort_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stability_distribution(UUID) TO service_role;


-- A.4 — get_difficulty_distribution
-- Five buckets over cards.difficulty (FLOAT, FSRS domain ~[1, 10]).

CREATE FUNCTION public.get_difficulty_distribution(
  p_user_id UUID
)
RETURNS TABLE (bucket TEXT, sort_key INT, count INT)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    SELECT
      COUNT(*) FILTER (WHERE c.difficulty <  2.5)                        ::INT AS b_lt_2_5,
      COUNT(*) FILTER (WHERE c.difficulty >= 2.5 AND c.difficulty < 3.5) ::INT AS b_2_5_3_5,
      COUNT(*) FILTER (WHERE c.difficulty >= 3.5 AND c.difficulty < 4.5) ::INT AS b_3_5_4_5,
      COUNT(*) FILTER (WHERE c.difficulty >= 4.5 AND c.difficulty < 5.5) ::INT AS b_4_5_5_5,
      COUNT(*) FILTER (WHERE c.difficulty >= 5.5)                        ::INT AS b_5_5_plus
    FROM public.cards c
    WHERE c.user_id = p_user_id
      AND c.state IN (2, 3)
      AND c.is_suspended = FALSE
  )
  SELECT v.bucket, v.sort_key, v.count
  FROM counts c,
  LATERAL (VALUES
    ('1.5-2.5'::TEXT, 1, c.b_lt_2_5),
    ('2.5-3.5'::TEXT, 2, c.b_2_5_3_5),
    ('3.5-4.5'::TEXT, 3, c.b_3_5_4_5),
    ('4.5-5.5'::TEXT, 4, c.b_4_5_5_5),
    ('5.5+'::TEXT,    5, c.b_5_5_plus)
  ) AS v(bucket, sort_key, count)
  ORDER BY v.sort_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_difficulty_distribution(UUID) TO service_role;


-- A.5 — get_cards_added_this_month
-- Tz-aware month-to-date count of personal cards. The learner's timezone
-- is passed in so the boundary matches the wall clock they see rather
-- than snapping to UTC.

CREATE FUNCTION public.get_cards_added_this_month(
  p_user_id  UUID,
  p_timezone TEXT
)
RETURNS INT
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count       INT;
  v_month_start TIMESTAMPTZ;
BEGIN
  v_month_start :=
    date_trunc('month', (NOW() AT TIME ZONE p_timezone))
    AT TIME ZONE p_timezone;

  SELECT COUNT(*)::INT
    INTO v_count
  FROM public.cards c
  WHERE c.user_id    = p_user_id
    AND c.created_at >= v_month_start;

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cards_added_this_month(UUID, TEXT) TO service_role;


-- ─── B. Cleanup + extend the analytics surface ──────────────────────────────
--
-- Drop every existing overload of get_heatmap_data and get_dashboard_data,
-- then create exactly one canonical signature each. This collapses the
-- accidental overload pair created by the 20260529/20260604/20260614 trio
-- and brings the live wire contract to a single, intentional shape.

DROP FUNCTION IF EXISTS public.get_heatmap_data(UUID);
DROP FUNCTION IF EXISTS public.get_heatmap_data(UUID, TEXT);

CREATE FUNCTION public.get_heatmap_data(
  p_user_id  UUID,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE (
  date          TEXT,
  retention     FLOAT,
  count         BIGINT,
  total_seconds BIGINT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH bounds AS (
    SELECT DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) - INTERVAL '364 days' AS local_lo
  )
  SELECT
    TO_CHAR(rl.reviewed_at AT TIME ZONE p_timezone, 'YYYY-MM-DD') AS date,
    ROUND(
      (COUNT(*) FILTER (WHERE rl.rating IN ('good', 'easy'))::NUMERIC
      / COUNT(*) * 100),
      1
    )::FLOAT                                                       AS retention,
    COUNT(*)                                                       AS count,
    -- review_time_ms is nullable; pre-instrumentation rows COALESCE to
    -- zero so historical heatmap days under-report duration until new
    -- reviews accumulate. The metric becomes faithful as the learner
    -- reviews going forward.
    COALESCE(SUM(COALESCE(rl.review_time_ms, 0)), 0) / 1000        AS total_seconds
  FROM public.review_logs rl, bounds b
  WHERE rl.user_id     = p_user_id
    AND rl.reviewed_at >= (b.local_lo AT TIME ZONE p_timezone)
  GROUP BY TO_CHAR(rl.reviewed_at AT TIME ZONE p_timezone, 'YYYY-MM-DD')
  ORDER BY date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_heatmap_data(UUID, TEXT) TO service_role;


DROP FUNCTION IF EXISTS public.get_dashboard_data(UUID);
DROP FUNCTION IF EXISTS public.get_dashboard_data(UUID, TEXT);

CREATE FUNCTION public.get_dashboard_data(
  p_user_id  UUID,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'heatmap', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'date',          h.date,
         'retention',     h.retention,
         'count',         h.count,
         'total_seconds', h.total_seconds
       ))
       FROM public.get_heatmap_data(p_user_id, p_timezone) AS h),
      '[]'::jsonb
    ),
    'accuracy', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'layout_type', a.layout_type,
         'total',       a.total,
         'successful',  a.successful
       ))
       FROM public.get_accuracy_by_layout_type(p_user_id) AS a),
      '[]'::jsonb
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
    ),
    'cards_added_this_month',
      public.get_cards_added_this_month(p_user_id, p_timezone)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_data(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.get_dashboard_data(UUID, TEXT) IS
  'Bundled analytics for /api/v1/analytics/dashboard. 2026-05-18 consolidation:
   replaces the accidental dual overload created by 20260529 + 20260604/14, adds
   total_seconds per heatmap day, and bundles cards_added_this_month (tz-aware).
   Calls the renamed get_accuracy_by_layout_type per 20260614.';
