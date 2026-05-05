-- =============================================================
-- Migration: 20260508000002_get_review_forecast_rpc.sql
-- Severity: MEDIUM — performance + correctness
--
-- The previous review.service.ts implementation fetched every
-- non-suspended due card in a 14-day window and grouped them
-- in JS. For users with thousands of scheduled cards this
-- transferred 100+ KB of unnecessary data per dashboard load.
--
-- This RPC moves the GROUP BY server-side. Returns the same shape
-- the service layer already maps to ForecastDay (date, count).
-- The is_suspended = FALSE filter combined with the date range
-- benefits from cards_due_active_idx (added in 20260508000000).
--
-- No auth.uid() guard — consistent with the post-Sprint-1 pattern:
-- the service layer authenticates via JWT before invoking the RPC,
-- and the RPC trusts the parameter user_id.
-- =============================================================

CREATE OR REPLACE FUNCTION get_review_forecast(
  p_user_id UUID,
  p_days    INT DEFAULT 14
)
RETURNS TABLE(date TEXT, count BIGINT)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT
      DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'                                        AS lo,
      (DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + (p_days || ' days')::INTERVAL      AS hi
  )
  SELECT
    TO_CHAR(c.due AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    COUNT(*)                                        AS count
  FROM public.cards c, bounds b
  WHERE c.user_id      = p_user_id
    AND c.is_suspended = FALSE
    AND c.due         >= b.lo
    AND c.due          < b.hi
  GROUP BY TO_CHAR(c.due AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  ORDER BY date;
$$;
