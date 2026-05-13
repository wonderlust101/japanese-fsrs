-- Return forecast counts split by source instead of letting the UI project
-- the learner's daily new-card limit into every future day.

DROP FUNCTION IF EXISTS public.get_review_forecast(UUID, INT);
DROP FUNCTION IF EXISTS public.get_review_forecast(UUID, INT, TEXT);

CREATE OR REPLACE FUNCTION public.get_review_forecast(
  p_user_id  UUID,
  p_days     INT DEFAULT 14,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  date          TEXT,
  count         BIGINT,
  backlog_count BIGINT,
  review_count  BIGINT,
  new_count     BIGINT
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT
      DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) AS local_lo,
      DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) + (p_days || ' days')::INTERVAL AS local_hi
  ),
  forecast_rows AS (
    -- Overdue non-new cards belong to today's route as backlog.
    SELECT
      TO_CHAR(b.local_lo, 'YYYY-MM-DD') AS date,
      COUNT(*)                          AS backlog_count,
      0::BIGINT                         AS review_count,
      0::BIGINT                         AS new_count
    FROM public.cards c
    CROSS JOIN bounds b
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        IN (1, 2, 3)
      AND c.due          < (b.local_lo AT TIME ZONE p_timezone)
    GROUP BY b.local_lo

    UNION ALL

    -- Scheduled non-new cards stay on their actual due day.
    SELECT
      TO_CHAR(c.due AT TIME ZONE p_timezone, 'YYYY-MM-DD') AS date,
      0::BIGINT                                            AS backlog_count,
      COUNT(*)                                             AS review_count,
      0::BIGINT                                            AS new_count
    FROM public.cards c
    CROSS JOIN bounds b
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        IN (1, 2, 3)
      AND c.due         >= (b.local_lo AT TIME ZONE p_timezone)
      AND c.due          < (b.local_hi AT TIME ZONE p_timezone)
    GROUP BY TO_CHAR(c.due AT TIME ZONE p_timezone, 'YYYY-MM-DD')

    UNION ALL

    -- New cards are unscheduled inventory. Count the actual available new
    -- cards today, not the profile's daily new-card limit.
    SELECT
      TO_CHAR(b.local_lo, 'YYYY-MM-DD') AS date,
      0::BIGINT                         AS backlog_count,
      0::BIGINT                         AS review_count,
      COUNT(*)                          AS new_count
    FROM public.cards c
    CROSS JOIN bounds b
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        = 0
    GROUP BY b.local_lo
  )
  SELECT
    fr.date,
    SUM(fr.backlog_count + fr.review_count + fr.new_count)::BIGINT AS count,
    SUM(fr.backlog_count)::BIGINT                                  AS backlog_count,
    SUM(fr.review_count)::BIGINT                                   AS review_count,
    SUM(fr.new_count)::BIGINT                                      AS new_count
  FROM forecast_rows fr
  GROUP BY fr.date
  HAVING SUM(fr.backlog_count + fr.review_count + fr.new_count) > 0
  ORDER BY fr.date;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_forecast(UUID, INT, TEXT) TO service_role;
