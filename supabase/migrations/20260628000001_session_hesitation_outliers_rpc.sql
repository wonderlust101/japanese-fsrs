-- Migration: 20260628000001_session_hesitation_outliers_rpc.sql
--
-- New RPC `get_session_hesitation_outliers(session_id, user_id)` returning
-- the top 3 cards from a session by `review_time_ms` (descending, NULLs
-- last). Joined to `cards` for word + reading + meaning so the frontend
-- can render the row inline without a second round-trip.
--
-- Used by the review-summary surface to show "Cards you hesitated on" —
-- a different read on the session than the lapse-driven weak-spots list.

CREATE OR REPLACE FUNCTION get_session_hesitation_outliers(
  p_session_id UUID,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_envelope JSONB;
BEGIN
  WITH outliers AS (
    SELECT
      rl.card_id,
      c.fields_data->>'word'    AS word,
      c.fields_data->>'reading' AS reading,
      c.fields_data->>'meaning' AS meaning,
      rl.rating,
      rl.review_time_ms
    FROM public.review_logs rl
    LEFT JOIN public.cards c ON c.id = rl.card_id
    WHERE rl.session_id     = p_session_id
      AND rl.user_id        = p_user_id
      AND rl.review_time_ms IS NOT NULL
      AND rl.review_time_ms > 0
      -- Filter out absurd hesitations (e.g. user stepped away mid-review).
      -- 5 minutes is well above any genuine recall time but below the
      -- typical "I went to make coffee" outlier.
      AND rl.review_time_ms <= 300000
      AND c.fields_data->>'word' IS NOT NULL
    ORDER BY rl.review_time_ms DESC NULLS LAST
    LIMIT 3
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'cardId',       card_id,
      'word',         word,
      'reading',      reading,
      'meaning',      meaning,
      'rating',       rating,
      'reviewTimeMs', review_time_ms
    )),
    '[]'::jsonb
  ) INTO v_envelope
  FROM outliers;

  RETURN v_envelope;
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_hesitation_outliers(UUID, UUID) TO service_role;
