-- Migration: 20260711000000_session_summary_single_pass_sargable.sql
--
-- Perf-only rewrite of the two summary-view RPCs (audit R4). No behavioral
-- change: both functions return the exact same JSONB envelope keys as the live
-- definitions (get_session_summary from 20260709000000, get_day_review_aggregate
-- from 20260702000000), so the service-layer Zod schemas
-- (SessionSummaryEnvelopeSchema in review.service.ts, AggregateEnvelopeSchema in
-- day-reflection.service.ts) parse unchanged.
--
-- Two fixes:
--
--   1. Sargable "today" filter. Both functions counted the user-local day with
--      `(reviewed_at AT TIME ZONE tz)::DATE = v_target_date` — a per-row
--      function on the indexed column, so Postgres could not use
--      review_logs(user_id, reviewed_at) and scanned the user's ENTIRE history
--      on every call. We precompute the day's UTC bounds once
--      (local-midnight → timestamptz) and filter `reviewed_at >= start AND
--      reviewed_at < end` (half-open), which drives the index as a range scan.
--
--   2. Single pass (get_session_summary only). The old body ran its logs+agg
--      CTE twice — once to compute a not-found guard, once to build the
--      envelope. We build the envelope and capture `total` in one statement,
--      then RAISE if total = 0. The not-found path stays cheap: an empty
--      session yields v_target_date = NULL, so sessions_in_day short-circuits
--      and agg.total = 0 before the guard fires.
--
-- Forward-only. Signatures unchanged → existing GRANTs persist; re-stated below
-- per the standing SECURITY DEFINER policy.

-- ── get_session_summary (single pass + sargable) ────────────────────────────
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
  v_day_start   TIMESTAMPTZ;
  v_day_end     TIMESTAMPTZ;
  v_envelope    JSONB;
BEGIN
  -- User-local date of the session's earliest review (indexed by session_id),
  -- so sessions_today counts within the day that CONTAINS this session, not
  -- "today" in absolute terms (handles opening the summary the morning after a
  -- late-night session).
  SELECT (rl.reviewed_at AT TIME ZONE p_timezone)::DATE
    INTO v_target_date
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    ORDER BY rl.reviewed_at ASC
    LIMIT 1;

  -- Sargable day bounds: local midnight → UTC instants, so sessions_in_day
  -- uses the review_logs(user_id, reviewed_at) index instead of a per-row
  -- timezone cast over the whole history.
  IF v_target_date IS NOT NULL THEN
    v_day_start := v_target_date::timestamp           AT TIME ZONE p_timezone;
    v_day_end   := (v_target_date + 1)::timestamp     AT TIME ZONE p_timezone;
  END IF;

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
  weak_spots_with_cards AS (
    SELECT
      l.id          AS weak_spot_id,
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
    -- Cap at 2: only "first session ever" vs. "returning" is needed. The
    -- LIMIT-2 subquery avoids a full history scan.
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
      AND v_day_start IS NOT NULL
      AND rl.reviewed_at >= v_day_start
      AND rl.reviewed_at <  v_day_end
  )
  SELECT
    jsonb_build_object(
      'total',         a.total,
      'breakdown',     jsonb_build_object(
                         'again', a.again_count,
                         'hard',  a.hard_count,
                         'good',  a.good_count,
                         'easy',  a.easy_count
                       ),
      'total_time_ms', a.total_time_ms,
      'next_due_at',   a.next_due_at,
      'weak_spots',    COALESCE(
                         (SELECT jsonb_agg(jsonb_build_object(
                            'weak_spot_id', l.weak_spot_id,
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
                          FROM weak_spots_with_cards l),
                         '[]'::jsonb
                       ),
      'user_total_sessions', (SELECT total_sessions FROM user_total),
      'sessions_today',      (SELECT cnt            FROM sessions_in_day)
    ),
    a.total
  INTO v_envelope, v_total
  FROM agg a;

  IF v_total = 0 OR v_total IS NULL THEN
    RAISE EXCEPTION 'session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'No review logs found for this session.';
  END IF;

  RETURN v_envelope;
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_summary(UUID, UUID, TEXT) TO service_role;

-- ── get_day_review_aggregate (sargable day filter) ──────────────────────────
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
  v_day_start   TIMESTAMPTZ;
  v_day_end     TIMESTAMPTZ;
  v_envelope    JSONB;
BEGIN
  -- Anchor to the session's first review so a session spanning midnight stays
  -- attached to its starting day (matches the learner's mental model).
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

  -- Sargable day bounds (see get_session_summary).
  v_day_start := v_target_date::timestamp       AT TIME ZONE p_timezone;
  v_day_end   := (v_target_date + 1)::timestamp AT TIME ZONE p_timezone;

  WITH day_logs AS (
    SELECT rl.rating, rl.review_time_ms, rl.session_id
      FROM public.review_logs rl
      WHERE rl.user_id = p_user_id
        AND rl.reviewed_at >= v_day_start
        AND rl.reviewed_at <  v_day_end
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
