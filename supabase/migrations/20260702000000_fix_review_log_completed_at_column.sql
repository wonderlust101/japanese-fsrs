-- Migration: 20260702000000_fix_review_log_completed_at_column.sql
--
-- Bugfix: `get_day_review_aggregate` (20260627000000) and `get_session_summary`
-- (20260628000000) both reference `review_logs.completed_at`, a column that
-- has never existed — the timestamp column on `review_logs` is `reviewed_at`
-- (defined in 20260425000001). Postgres parses plpgsql bodies lazily, so the
-- original CREATE statements succeeded but every call fails at runtime with
-- `42703: column rl.completed_at does not exist`, 500-ing the session-summary
-- and day-reflection endpoints.
--
-- Forward-only fix: CREATE OR REPLACE both functions with the bodies from
-- their originating migrations, swapping `completed_at` -> `reviewed_at`. No
-- signature change, so existing GRANTs persist; they are re-stated below to
-- keep the SECURITY DEFINER grant explicit per standing policy.
--
-- The third function carrying the same typo, `get_practice_consistency`
-- (20260628000002), was already dropped in 20260630000000 and is not
-- recreated here.

-- ── get_day_review_aggregate ────────────────────────────────────────────────
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
  SELECT (rl.reviewed_at AT TIME ZONE p_timezone)::DATE
    INTO v_target_date
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    ORDER BY rl.reviewed_at ASC
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
        AND (rl.reviewed_at AT TIME ZONE p_timezone)::DATE = v_target_date
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

-- ── get_session_summary ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_session_summary(
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
  v_total       INT;
  v_target_date DATE;
  v_envelope    JSONB;
BEGIN
  -- Derive the user-local date from the session's earliest review, so
  -- sessions_today counts within the day that contains this session,
  -- not "today" in absolute terms (covers the case where the user opens
  -- the summary the morning after a late-night session).
  SELECT (rl.reviewed_at AT TIME ZONE p_timezone)::DATE
    INTO v_target_date
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    ORDER BY rl.reviewed_at ASC
    LIMIT 1;

  WITH logs AS (
    SELECT rl.rating, rl.review_time_ms, rl.due_after
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    LIMIT 5000
  ),
  agg AS (
    SELECT
      COUNT(*)::INT                                                AS total,
      COUNT(*) FILTER (WHERE rating = 'again')::INT                AS again_count,
      COUNT(*) FILTER (WHERE rating = 'hard')::INT                 AS hard_count,
      COUNT(*) FILTER (WHERE rating = 'good')::INT                 AS good_count,
      COUNT(*) FILTER (WHERE rating = 'easy')::INT                 AS easy_count,
      COALESCE(SUM(COALESCE(review_time_ms, 0)), 0)::BIGINT        AS total_time_ms,
      MIN(due_after)                                               AS next_due_at
    FROM logs
  ),
  leeches_with_cards AS (
    SELECT
      l.id          AS leech_id,
      l.card_id,
      c.deck_id,
      c.fields_data->>'word'    AS word,
      c.fields_data->>'reading' AS reading,
      c.lapses,
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.weak_spots l
    LEFT JOIN public.cards c ON c.id = l.card_id
    WHERE l.session_id = p_session_id
      AND l.user_id    = p_user_id
  ),
  user_total AS (
    -- Cap at 2: we only need to know "first session ever" vs. "returning".
    -- Using a subquery with LIMIT prevents a full table scan when the
    -- learner has thousands of sessions in their history.
    SELECT LEAST((SELECT COUNT(DISTINCT session_id) FROM (
      SELECT session_id FROM public.review_logs
        WHERE user_id = p_user_id AND session_id IS NOT NULL
        LIMIT 2
    ) AS s), 2)::INT AS total_sessions
  ),
  sessions_in_day AS (
    SELECT COUNT(DISTINCT rl.session_id)::INT AS cnt
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND v_target_date IS NOT NULL
      AND (rl.reviewed_at AT TIME ZONE p_timezone)::DATE = v_target_date
  )
  SELECT a.total INTO v_total FROM agg a;

  IF v_total = 0 OR v_total IS NULL THEN
    RAISE EXCEPTION 'session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'No review logs found for this session.';
  END IF;

  -- Re-run the CTE chain for the envelope build. (Matches the established
  -- pattern of the original function.)
  WITH logs AS (
    SELECT rl.rating, rl.review_time_ms, rl.due_after
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    LIMIT 5000
  ),
  agg AS (
    SELECT
      COUNT(*)::INT                                                AS total,
      COUNT(*) FILTER (WHERE rating = 'again')::INT                AS again_count,
      COUNT(*) FILTER (WHERE rating = 'hard')::INT                 AS hard_count,
      COUNT(*) FILTER (WHERE rating = 'good')::INT                 AS good_count,
      COUNT(*) FILTER (WHERE rating = 'easy')::INT                 AS easy_count,
      COALESCE(SUM(COALESCE(review_time_ms, 0)), 0)::BIGINT        AS total_time_ms,
      MIN(due_after)                                               AS next_due_at
    FROM logs
  ),
  leeches_with_cards AS (
    SELECT
      l.id          AS leech_id,
      l.card_id,
      c.deck_id,
      c.fields_data->>'word'    AS word,
      c.fields_data->>'reading' AS reading,
      c.lapses,
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.weak_spots l
    LEFT JOIN public.cards c ON c.id = l.card_id
    WHERE l.session_id = p_session_id
      AND l.user_id    = p_user_id
  ),
  user_total AS (
    SELECT LEAST((SELECT COUNT(DISTINCT session_id) FROM (
      SELECT session_id FROM public.review_logs
        WHERE user_id = p_user_id AND session_id IS NOT NULL
        LIMIT 2
    ) AS s), 2)::INT AS total_sessions
  ),
  sessions_in_day AS (
    SELECT COALESCE(COUNT(DISTINCT rl.session_id), 0)::INT AS cnt
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND v_target_date IS NOT NULL
      AND (rl.reviewed_at AT TIME ZONE p_timezone)::DATE = v_target_date
  )
  SELECT jsonb_build_object(
    'total',         a.total,
    'breakdown',     jsonb_build_object(
                       'again', a.again_count,
                       'hard',  a.hard_count,
                       'good',  a.good_count,
                       'easy',  a.easy_count
                     ),
    'total_time_ms', a.total_time_ms,
    'next_due_at',   a.next_due_at,
    'weak_spots',       COALESCE(
                       (SELECT jsonb_agg(jsonb_build_object(
                          'leech_id',     l.leech_id,
                          'card_id',      l.card_id,
                          'deck_id',      l.deck_id,
                          'word',         l.word,
                          'reading',      l.reading,
                          'lapses',       l.lapses,
                          'diagnosis',    l.diagnosis,
                          'prescription', l.prescription,
                          'resolved',     l.resolved,
                          'created_at',   l.created_at
                        ))
                        FROM leeches_with_cards l),
                       '[]'::jsonb
                     ),
    'user_total_sessions', (SELECT total_sessions FROM user_total),
    'sessions_today',      (SELECT cnt            FROM sessions_in_day)
  ) INTO v_envelope
  FROM agg a;

  RETURN v_envelope;
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_summary(UUID, UUID, TEXT) TO service_role;
