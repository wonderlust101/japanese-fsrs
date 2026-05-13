-- =============================================================
-- Learner-timezone review buckets
--
-- Dashboard copy, forecast bars, daily limits, and backlog
-- classification all speak in learner-local calendar days. These
-- RPCs used UTC day buckets, which made late-evening and early-
-- morning sessions disagree with the visible dashboard date.
-- =============================================================

DROP FUNCTION IF EXISTS public.get_dashboard_data(UUID);
DROP FUNCTION IF EXISTS public.get_due_cards(UUID, INT, INT);
DROP FUNCTION IF EXISTS public.get_review_forecast(UUID, INT);
DROP FUNCTION IF EXISTS public.get_heatmap_data(UUID);

CREATE OR REPLACE FUNCTION public.get_due_cards(
  p_user_id               UUID,
  p_daily_review_limit    INT,
  p_daily_new_cards_limit INT,
  p_timezone              TEXT DEFAULT 'UTC'
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
    SELECT DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) AT TIME ZONE p_timezone AS lo
  ),
  counts AS (
    SELECT
      COUNT(*)                                    AS total_today,
      COUNT(*) FILTER (WHERE rl.state_before = 0) AS new_today
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
      AND c.state        IN (1, 2, 3)
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

GRANT EXECUTE ON FUNCTION public.get_due_cards(UUID, INT, INT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_review_forecast(
  p_user_id  UUID,
  p_days     INT DEFAULT 14,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(date TEXT, count BIGINT)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT
      DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) AS local_lo,
      DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) + (p_days || ' days')::INTERVAL AS local_hi
  )
  SELECT
    TO_CHAR(c.due AT TIME ZONE p_timezone, 'YYYY-MM-DD') AS date,
    COUNT(*)                                             AS count
  FROM public.cards c, bounds b
  WHERE c.user_id      = p_user_id
    AND c.is_suspended = FALSE
    AND c.due         >= (b.local_lo AT TIME ZONE p_timezone)
    AND c.due          < (b.local_hi AT TIME ZONE p_timezone)
  GROUP BY TO_CHAR(c.due AT TIME ZONE p_timezone, 'YYYY-MM-DD')
  ORDER BY date;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_forecast(UUID, INT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_heatmap_data(
  p_user_id  UUID,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(date TEXT, retention FLOAT, count BIGINT)
LANGUAGE plpgsql
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
    )::FLOAT                                                      AS retention,
    COUNT(*)                                                      AS count
  FROM public.review_logs rl, bounds b
  WHERE rl.user_id = p_user_id
    AND rl.reviewed_at >= (b.local_lo AT TIME ZONE p_timezone)
  GROUP BY TO_CHAR(rl.reviewed_at AT TIME ZONE p_timezone, 'YYYY-MM-DD')
  ORDER BY date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_heatmap_data(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_dashboard_data(
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
         'date',      h.date,
         'retention', h.retention,
         'count',     h.count
       ))
       FROM public.get_heatmap_data(p_user_id, p_timezone) AS h),
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

GRANT EXECUTE ON FUNCTION public.get_dashboard_data(UUID, TEXT) TO service_role;
