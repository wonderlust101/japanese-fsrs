-- Migration: 20260627000000_day_review_aggregate_rpc.sql
--
-- New RPC `get_day_review_aggregate(session_id, user_id, timezone)` that
-- aggregates all review_logs for the user-local calendar day that contains
-- the given session, plus the top 3 weak-spot words surfaced by any session
-- on that day. Feeds the post-session day-reflection AI generator (see
-- apps/api/src/services/day-reflection.service.ts).
--
-- Day boundary is computed in the user's local timezone via
-- `timezone(p_timezone, completed_at)::DATE`, matching the pattern used by
-- `get_heatmap_data` and the TomoNote service.
--
-- SECURITY DEFINER + pinned `search_path = ''` per the standing policy. The
-- function reads `review_logs`, `weak_spots`, and `cards`; all three are
-- the user's own rows, narrowed by the explicit `p_user_id` parameter.

CREATE OR REPLACE FUNCTION get_day_review_aggregate(
  p_session_id UUID,
  p_user_id    UUID,
  p_timezone   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_date DATE;
  v_envelope    JSONB;
BEGIN
  -- Derive the user-local date from the session's earliest review. Anchoring
  -- to the first review rather than the last keeps a session-spanning-
  -- midnight session attached to its starting day, which matches the
  -- learner's mental model of when they "did the work".
  SELECT (rl.completed_at AT TIME ZONE p_timezone)::DATE
    INTO v_target_date
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    ORDER BY rl.completed_at ASC
    LIMIT 1;

  IF v_target_date IS NULL THEN
    RAISE EXCEPTION 'session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'No review logs found for this session.';
  END IF;

  WITH day_logs AS (
    SELECT rl.rating, rl.review_time_ms, rl.session_id
      FROM public.review_logs rl
      WHERE rl.user_id = p_user_id
        AND (rl.completed_at AT TIME ZONE p_timezone)::DATE = v_target_date
      LIMIT 5000
  ),
  day_sessions AS (
    SELECT DISTINCT session_id FROM day_logs
  ),
  agg AS (
    SELECT
      COUNT(*)::INT                                                AS total,
      COUNT(*) FILTER (WHERE rating = 'again')::INT                AS again_count,
      COUNT(*) FILTER (WHERE rating = 'hard')::INT                 AS hard_count,
      COUNT(*) FILTER (WHERE rating = 'good')::INT                 AS good_count,
      COUNT(*) FILTER (WHERE rating = 'easy')::INT                 AS easy_count,
      COALESCE(SUM(COALESCE(review_time_ms, 0)), 0)::BIGINT        AS total_time_ms
    FROM day_logs
  ),
  session_list AS (
    SELECT
      COALESCE(
        jsonb_agg(session_id::TEXT ORDER BY session_id::TEXT),
        '[]'::jsonb
      ) AS ids,
      COALESCE(COUNT(*), 0)::INT AS cnt
    FROM day_sessions
  ),
  day_weak_spots AS (
    SELECT c.fields_data->>'word' AS word
    FROM public.weak_spots ws
    LEFT JOIN public.cards c ON c.id = ws.card_id
    WHERE ws.user_id = p_user_id
      AND ws.session_id IN (SELECT session_id FROM day_sessions)
      AND c.fields_data->>'word' IS NOT NULL
      AND ws.session_id IS NOT NULL
    ORDER BY ws.created_at DESC
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'date_key',        v_target_date::TEXT,
    'session_ids',     s.ids,
    'session_count',   s.cnt,
    'total_cards',     a.total,
    'total_time_ms',   a.total_time_ms,
    'breakdown',       jsonb_build_object(
                         'again', a.again_count,
                         'hard',  a.hard_count,
                         'good',  a.good_count,
                         'easy',  a.easy_count
                       ),
    'weak_spot_words', COALESCE(
                         (SELECT jsonb_agg(word) FROM day_weak_spots),
                         '[]'::jsonb
                       )
  ) INTO v_envelope
  FROM agg a CROSS JOIN session_list s;

  RETURN v_envelope;
END;
$$;

GRANT EXECUTE ON FUNCTION get_day_review_aggregate(UUID, UUID, TEXT) TO service_role;
