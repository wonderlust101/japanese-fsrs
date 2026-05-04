-- Analytics RPCs for streak, JLPT gap, and JLPT milestone forecast.
-- All SECURITY DEFINER + SET search_path = public so callers don't need RLS
-- privileges; p_user_id scopes every query to the requesting user's data.

-- ─── Streak ───────────────────────────────────────────────────────────────────
-- Returns current_streak, longest_streak, and last_review_date.
--
-- Current streak: consecutive UTC calendar days ending at "today" (yesterday is
-- still in-streak so the user has until end-of-day UTC to keep it alive). If
-- the user has not reviewed today or yesterday, current_streak = 0.
--
-- Longest streak: the longest run of consecutive review days in the user's
-- history. Computed via the classic "(date - row_number) groups consecutive days"
-- trick on DISTINCT review days.
--
-- Empty history: returns a single row of zeros / NULL so callers always get one row.
CREATE OR REPLACE FUNCTION get_streak(p_user_id UUID)
RETURNS TABLE(current_streak INT, longest_streak INT, last_review_date DATE)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT DISTINCT (reviewed_at AT TIME ZONE 'UTC')::DATE AS d
    FROM review_logs
    WHERE user_id = p_user_id
  ),
  grouped AS (
    SELECT d,
           d - (ROW_NUMBER() OVER (ORDER BY d))::INT AS grp
    FROM days
  ),
  runs AS (
    SELECT MIN(d) AS run_start, MAX(d) AS run_end, COUNT(*)::INT AS run_len
    FROM grouped
    GROUP BY grp
  ),
  current AS (
    SELECT COALESCE(MAX(run_len), 0) AS streak
    FROM runs
    WHERE run_end >= (CURRENT_DATE AT TIME ZONE 'UTC')::DATE - INTERVAL '1 day'
  ),
  longest AS (
    SELECT COALESCE(MAX(run_len), 0) AS streak FROM runs
  ),
  last_d AS (
    SELECT MAX(d) AS d FROM days
  )
  SELECT current.streak::INT, longest.streak::INT, last_d.d
  FROM current, longest, last_d;
$$;

-- ─── JLPT gap ─────────────────────────────────────────────────────────────────
-- For each JLPT level the user has subscribed cards for, returns:
--   total   = count of personal cards at that level,
--   learned = count of those cards where state >= 2 (Review or Relearning),
--   due     = count of those cards currently due for review.
--
-- "User's cards" are scoped by user_id so manually-added cards count too — not
-- only premade-fork cards. progress_pct is computed in the service layer.
--
-- Levels with zero cards are omitted; the frontend can render N5–N1 explicitly
-- and treat missing levels as "not started yet".
CREATE OR REPLACE FUNCTION get_jlpt_gap(p_user_id UUID)
RETURNS TABLE(jlpt_level TEXT, total BIGINT, learned BIGINT, due BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.jlpt_level::TEXT                                         AS jlpt_level,
    COUNT(*)                                                    AS total,
    COUNT(*) FILTER (WHERE c.state >= 2)                        AS learned,
    COUNT(*) FILTER (WHERE c.due <= NOW() AND c.status != 'suspended') AS due
  FROM cards c
  WHERE c.user_id = p_user_id
    AND c.jlpt_level IS NOT NULL
  GROUP BY c.jlpt_level
  ORDER BY c.jlpt_level;
$$;

-- ─── Milestone forecast ───────────────────────────────────────────────────────
-- For each JLPT level the user has cards in, projects a completion date based
-- on the user's average daily learning pace (cards reaching state >= 2 per day
-- over the last 30 days).
--
-- If daily_pace is 0 or NULL, projected_completion_date and days_remaining are
-- NULL — caller decides how to render "no projection yet".
CREATE OR REPLACE FUNCTION get_milestone_forecast(p_user_id UUID)
RETURNS TABLE(
  jlpt_level                  TEXT,
  total                       BIGINT,
  learned                     BIGINT,
  daily_pace                  NUMERIC,
  days_remaining              INT,
  projected_completion_date   DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pace AS (
    -- Cards that "graduated" to Review state in the last 30 days (state_before < 2 AND state >= 2),
    -- divided by the number of distinct active days in that window.
    SELECT
      CASE
        WHEN COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE) = 0 THEN 0
        ELSE COUNT(*)::NUMERIC
             / GREATEST(COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE), 1)
      END AS rate
    FROM review_logs rl
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
    FROM cards c
    WHERE c.user_id = p_user_id
      AND c.jlpt_level IS NOT NULL
    GROUP BY c.jlpt_level
  )
  SELECT
    pl.jlpt_level,
    pl.total,
    pl.learned,
    p.rate                                              AS daily_pace,
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
