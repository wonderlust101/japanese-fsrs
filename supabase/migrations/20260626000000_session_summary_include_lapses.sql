-- Migration: 20260626000000_session_summary_include_lapses.sql
--
-- Expose `cards.lapses` on each weak-spot row in the `get_session_summary`
-- payload so the review summary UI can render per-row lapse counts and
-- order by lapses-desc on the client. The cards JOIN is already paid for
-- (the CTE selects word + reading from `cards.fields_data`); this adds
-- one column to both CTE chains and one key to the `jsonb_build_object`.
--
-- Notes:
--   - `LEFT JOIN public.cards` (carried over from 20260615) means the
--     card row may be absent when a weak spot's card has been deleted.
--     `lapses` is therefore NULLABLE; the TS envelope schema reflects
--     this as `z.number().int().nonnegative().nullable()`.
--   - SECURITY DEFINER + pinned search_path are preserved.
--   - CREATE OR REPLACE retains the existing GRANT EXECUTE to service_role.

CREATE OR REPLACE FUNCTION get_session_summary(
  p_session_id UUID,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INT;
  v_envelope JSONB;
BEGIN
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
  )
  SELECT a.total INTO v_total FROM agg a;

  IF v_total = 0 OR v_total IS NULL THEN
    RAISE EXCEPTION 'session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'No review logs found for this session.';
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
                     )
  ) INTO v_envelope
  FROM agg a;

  RETURN v_envelope;
END;
$$;
