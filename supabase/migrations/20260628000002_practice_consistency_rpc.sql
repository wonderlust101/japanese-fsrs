-- Migration: 20260628000002_practice_consistency_rpc.sql
--
-- New RPC `get_practice_consistency(user_id, timezone)` returning factual
-- practice-rhythm counts:
--   • consecutive_days     — contiguous days (walking back from today in
--                            the user's TZ) with at least one review log.
--                            Capped at 30 for performance.
--   • sessions_this_week   — DISTINCT session_id count in the user's
--                            current ISO week.
--   • sessions_today       — DISTINCT session_id count for the user's
--                            local today.
--
-- The UI decides whether/how to surface these (the design avoids streak
-- gamification). The wire is intentionally just numbers.

CREATE OR REPLACE FUNCTION get_practice_consistency(
  p_user_id  UUID,
  p_timezone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today         DATE;
  v_week_start    DATE;
  v_consec        INT := 0;
  v_check_date    DATE;
  v_has_reviews   BOOLEAN;
  v_sessions_week INT;
  v_sessions_today INT;
  v_envelope      JSONB;
BEGIN
  v_today      := (now() AT TIME ZONE p_timezone)::DATE;
  -- ISO week starts on Monday. date_trunc('week', …) gives midnight Monday.
  v_week_start := (date_trunc('week', v_today::TIMESTAMP))::DATE;

  -- Walk backward from today counting contiguous days with reviews.
  -- The loop short-circuits on the first day with zero reviews. Cap at
  -- 30 iterations so the loop is bounded even for very consistent users.
  v_check_date := v_today;
  FOR i IN 1..30 LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.review_logs rl
      WHERE rl.user_id = p_user_id
        AND (rl.completed_at AT TIME ZONE p_timezone)::DATE = v_check_date
    ) INTO v_has_reviews;

    EXIT WHEN NOT v_has_reviews;
    v_consec := v_consec + 1;
    v_check_date := v_check_date - INTERVAL '1 day';
  END LOOP;

  -- Sessions this week (Monday → today inclusive)
  SELECT COUNT(DISTINCT rl.session_id)::INT
    INTO v_sessions_week
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND rl.session_id IS NOT NULL
      AND (rl.completed_at AT TIME ZONE p_timezone)::DATE >= v_week_start
      AND (rl.completed_at AT TIME ZONE p_timezone)::DATE <= v_today;

  -- Sessions today
  SELECT COUNT(DISTINCT rl.session_id)::INT
    INTO v_sessions_today
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND rl.session_id IS NOT NULL
      AND (rl.completed_at AT TIME ZONE p_timezone)::DATE = v_today;

  v_envelope := jsonb_build_object(
    'consecutiveDays',  v_consec,
    'sessionsThisWeek', COALESCE(v_sessions_week, 0),
    'sessionsToday',    COALESCE(v_sessions_today, 0)
  );

  RETURN v_envelope;
END;
$$;

GRANT EXECUTE ON FUNCTION get_practice_consistency(UUID, TEXT) TO service_role;
