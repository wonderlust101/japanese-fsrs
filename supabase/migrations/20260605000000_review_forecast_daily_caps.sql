-- Align the review forecast with the hero queue.
--
-- Why this change:
--   The hero (`get_due_cards`) clips to `daily_review_limit` / `daily_new_cards_limit`
--   and subtracts what's already been reviewed today. The forecast did neither,
--   so today's strip column counted the full overdue list, every card due later
--   today, and the entire unscheduled new-card inventory — producing totals
--   that did not match the hero (e.g. 72 vs 29).
--
-- Relationship to migration 20260530000000_review_forecast_actual_new_counts.sql:
--   That migration removed the previous behaviour of projecting the daily
--   new-card limit into every future day because the projection was unbounded
--   (it ignored remaining inventory). This migration restores a projection,
--   but bounded by remaining inventory and depleted day-by-day. Net effect:
--   future days show new cards only while the learner still has inventory to
--   draw from, and never more than `daily_new_cards_limit` per day.
--
-- Bucket semantics for today (matches `get_due_cards` fill order):
--   1. backlog fills first, capped at remaining_total
--   2. cards scheduled later today fill the remainder of remaining_total
--   3. new cards fill min(remaining_new, what's left of remaining_total)
--
-- Future days are not capped against history (nothing has happened yet); they
-- carry actual scheduled `review_count` and the projected `new_count`.

DROP FUNCTION IF EXISTS public.get_review_forecast(UUID, INT, TEXT);

CREATE OR REPLACE FUNCTION public.get_review_forecast(
  p_user_id               UUID,
  p_days                  INT  DEFAULT 14,
  p_timezone              TEXT DEFAULT 'UTC',
  p_daily_review_limit    INT  DEFAULT NULL,
  p_daily_new_cards_limit INT  DEFAULT NULL
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
  today_activity AS (
    SELECT
      COUNT(*)                                    AS total_today,
      COUNT(*) FILTER (WHERE rl.state_before = 0) AS new_today
    FROM public.review_logs rl, bounds b
    WHERE rl.user_id     = p_user_id
      AND rl.reviewed_at >= (b.local_lo AT TIME ZONE p_timezone)
  ),
  -- NULL daily limit means "no cap": fold to the BIGINT inventory total so
  -- the LEAST() arms below are well-defined without sentinel magic numbers.
  remaining AS (
    SELECT
      CASE
        WHEN p_daily_review_limit IS NULL THEN NULL::BIGINT
        ELSE GREATEST(0, p_daily_review_limit - total_today)::BIGINT
      END AS remaining_total,
      CASE
        WHEN p_daily_new_cards_limit IS NULL THEN NULL::BIGINT
        ELSE GREATEST(0, p_daily_new_cards_limit - new_today)::BIGINT
      END AS remaining_new
    FROM today_activity
  ),
  overdue_total AS (
    SELECT COUNT(*)::BIGINT AS n
    FROM public.cards c, bounds b
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        IN (1, 2, 3)
      AND c.due          < (b.local_lo AT TIME ZONE p_timezone)
  ),
  new_inventory AS (
    SELECT COUNT(*)::BIGINT AS n
    FROM public.cards c
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        = 0
  ),
  scheduled_per_day AS (
    SELECT
      TO_CHAR(c.due AT TIME ZONE p_timezone, 'YYYY-MM-DD') AS d,
      COUNT(*)::BIGINT                                     AS n
    FROM public.cards c, bounds b
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.state        IN (1, 2, 3)
      AND c.due         >= (b.local_lo AT TIME ZONE p_timezone)
      AND c.due          < (b.local_hi AT TIME ZONE p_timezone)
    GROUP BY 1
  ),
  per_day AS (
    SELECT
      idx,
      TO_CHAR((SELECT local_lo FROM bounds) + (idx || ' days')::INTERVAL, 'YYYY-MM-DD') AS d,
      COALESCE(spd.n, 0)::BIGINT AS scheduled
    FROM generate_series(0, p_days - 1) AS idx
    LEFT JOIN scheduled_per_day spd
      ON spd.d = TO_CHAR((SELECT local_lo FROM bounds) + (idx || ' days')::INTERVAL, 'YYYY-MM-DD')
  ),
  today_inputs AS (
    SELECT
      (SELECT n        FROM overdue_total)        AS overdue_n,
      (SELECT scheduled FROM per_day WHERE idx = 0) AS scheduled_today,
      (SELECT n        FROM new_inventory)        AS inventory_n,
      (SELECT remaining_total FROM remaining)      AS rem_total,
      (SELECT remaining_new   FROM remaining)      AS rem_new
  ),
  today_capped AS (
    SELECT
      -- backlog: full overdue when no cap, else clipped by remaining_total
      CASE WHEN ti.rem_total IS NULL THEN ti.overdue_n
           ELSE LEAST(ti.overdue_n, ti.rem_total)
      END AS backlog_today
    FROM today_inputs ti
  ),
  today_with_review AS (
    SELECT
      tc.backlog_today,
      CASE WHEN ti.rem_total IS NULL THEN ti.scheduled_today
           ELSE LEAST(ti.scheduled_today, GREATEST(0, ti.rem_total - tc.backlog_today))
      END AS review_today,
      ti.*
    FROM today_capped tc, today_inputs ti
  ),
  today_with_new AS (
    SELECT
      twr.backlog_today,
      twr.review_today,
      CASE
        WHEN twr.rem_new IS NULL AND twr.rem_total IS NULL THEN twr.inventory_n
        WHEN twr.rem_total IS NULL THEN LEAST(twr.inventory_n, twr.rem_new)
        WHEN twr.rem_new   IS NULL THEN LEAST(
                                          twr.inventory_n,
                                          GREATEST(0, twr.rem_total - twr.backlog_today - twr.review_today)
                                        )
        ELSE LEAST(
               twr.inventory_n,
               twr.rem_new,
               GREATEST(0, twr.rem_total - twr.backlog_today - twr.review_today)
             )
      END AS new_today
    FROM today_with_review twr
  ),
  -- Project the daily new-cards limit across future days, depleting remaining
  -- new inventory as we go. With a NULL cap (unbounded), each future day shows
  -- the whole remaining inventory — that's a rare admin/debug case; normal
  -- callers pass a real cap.
  future_projection AS (
    SELECT
      pd.idx,
      pd.d,
      pd.scheduled AS review_n,
      GREATEST(
        0,
        LEAST(
          COALESCE(p_daily_new_cards_limit::BIGINT, (SELECT n FROM new_inventory)),
          (SELECT n FROM new_inventory)
            - (SELECT new_today FROM today_with_new)
            - (pd.idx - 1)::BIGINT * COALESCE(p_daily_new_cards_limit::BIGINT, 0)
        )
      )::BIGINT AS new_n
    FROM per_day pd
    WHERE pd.idx > 0
  ),
  combined AS (
    SELECT
      (SELECT d FROM per_day WHERE idx = 0) AS date,
      backlog_today                          AS backlog_count,
      review_today                           AS review_count,
      new_today                              AS new_count
    FROM today_with_new
    UNION ALL
    SELECT
      fp.d,
      0::BIGINT,
      fp.review_n,
      fp.new_n
    FROM future_projection fp
  )
  SELECT
    c.date,
    (c.backlog_count + c.review_count + c.new_count)::BIGINT AS count,
    c.backlog_count,
    c.review_count,
    c.new_count
  FROM combined c
  WHERE (c.backlog_count + c.review_count + c.new_count) > 0
  ORDER BY c.date;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_forecast(UUID, INT, TEXT, INT, INT) TO service_role;
