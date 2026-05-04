-- ============================================================
-- Migration: 20260505000000_fix_numeric_daily_pace.sql
-- Severity: MEDIUM
--
-- Changes get_milestone_forecast() return type:
--   daily_pace: NUMERIC → FLOAT8
--
-- Rationale:
--   - Supabase gen types maps PostgreSQL NUMERIC → TypeScript string
--   - A daily cards-per-day pace does not need arbitrary precision
--   - FLOAT8 maps to TypeScript number, avoiding JSON parse loss
--   - Current hand-authored types use number; keeping schema in sync
--     prevents future discrepancies when adopting generated types
--
-- Safety: FLOAT8 preserves ~15-17 decimal digits of precision, more
--         than sufficient for realistic pace values (0.1 - 1000 cards/day)
-- ============================================================

-- Drop the function first (required to change RETURNS TABLE signature)
DROP FUNCTION IF EXISTS get_milestone_forecast(UUID);

CREATE FUNCTION get_milestone_forecast(p_user_id UUID)
RETURNS TABLE(
  jlpt_level                  TEXT,
  total                       BIGINT,
  learned                     BIGINT,
  daily_pace                  FLOAT8,
  days_remaining              INT,
  projected_completion_date   DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH pace AS (
    SELECT
      CASE
        WHEN COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE) = 0 THEN 0
        ELSE COUNT(*)::NUMERIC
             / GREATEST(COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE), 1)
      END AS rate
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND rl.reviewed_at >= NOW() - INTERVAL '30 days'
      AND rl.state_before IS NOT NULL
      AND rl.state_before < 2
      AND rl.rating IN ('good', 'easy')
  ),
  per_level AS (
    SELECT
      c.jlpt_level::TEXT                       AS jlpt_level,
      COUNT(*)                                 AS total,
      COUNT(*) FILTER (WHERE c.state >= 2)     AS learned
    FROM public.cards c
    WHERE c.user_id = p_user_id
      AND c.jlpt_level IS NOT NULL
    GROUP BY c.jlpt_level
  )
  SELECT
    pl.jlpt_level,
    pl.total,
    pl.learned,
    (p.rate)::FLOAT8                                       AS daily_pace,
    CASE
      WHEN p.rate IS NULL OR p.rate = 0 THEN NULL
      ELSE CEIL(GREATEST(pl.total - pl.learned, 0) / p.rate)::INT
    END                                                 AS days_remaining,
    CASE
      WHEN p.rate IS NULL OR p.rate = 0 THEN NULL
      ELSE (CURRENT_DATE
        + (CEIL(GREATEST(pl.total - pl.learned, 0) / p.rate)::INT) * INTERVAL '1 day')::DATE
    END                                                 AS projected_completion_date
  FROM per_level pl, pace p
  ORDER BY pl.jlpt_level;
$$;
