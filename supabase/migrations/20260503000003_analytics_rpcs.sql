-- Analytics RPC functions for the heatmap and accuracy-by-layout endpoints.
-- Both functions are SECURITY DEFINER so the caller need not hold RLS privileges;
-- the p_user_id parameter scopes every query to the requesting user's data.

-- ─── Heatmap ──────────────────────────────────────────────────────────────────
-- Returns one row per UTC calendar day in the last 365 days that has at least one
-- review. Days with zero reviews are omitted — the frontend fills those gaps as 0,
-- consistent with how getReviewForecast handles sparse forecast data.
--
-- Uses: review_logs_user_id_reviewed_at_idx (user_id, reviewed_at)
CREATE OR REPLACE FUNCTION get_heatmap_data(p_user_id UUID)
RETURNS TABLE(date TEXT, retention FLOAT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    TO_CHAR(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')  AS date,
    ROUND(
      (COUNT(*) FILTER (WHERE rating IN ('good', 'easy'))::NUMERIC
      / COUNT(*) * 100),
      1
    )                                                        AS retention,
    COUNT(*)                                                 AS count
  FROM review_logs
  WHERE user_id    = p_user_id
    AND reviewed_at >= NOW() - INTERVAL '365 days'
  GROUP BY TO_CHAR(reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  ORDER BY date;
$$;

-- ─── Accuracy by layout ───────────────────────────────────────────────────────
-- Joins review_logs → cards and groups by card_type (the cognitive modality column:
-- comprehension | production | listening). Returns raw counts; the service layer
-- computes the accuracyPct percentage to keep SQL simple and consistent with the
-- pattern used in getSessionSummary.
--
-- Uses: review_logs_card_id_idx (join), review_logs_user_id_reviewed_at_idx (filter)
CREATE OR REPLACE FUNCTION get_accuracy_by_layout(p_user_id UUID)
RETURNS TABLE(layout TEXT, total BIGINT, successful BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.card_type::TEXT                                       AS layout,
    COUNT(*)                                                AS total,
    COUNT(*) FILTER (WHERE rl.rating IN ('good', 'easy'))   AS successful
  FROM review_logs rl
  JOIN cards c ON c.id = rl.card_id
  WHERE rl.user_id = p_user_id
  GROUP BY c.card_type
  ORDER BY c.card_type;
$$;
