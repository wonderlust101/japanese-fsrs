-- =============================================================
-- Migration: 20260516000000_pagination_and_session_summary_rpcs.sql
--
-- Two new RPCs from the query-discipline audit. Both additive — no
-- existing RPCs touched.
--
--   A. list_cards_paginated — fixes the cursor tiebreaker bug in
--      card.service.listCards. Cards sharing the same created_at
--      (e.g. the bulk clone in subscribe_to_premade_deck writes ~10–80
--      cards with `created_at = NOW()` in one transaction) currently
--      get skipped at page boundaries because the JS-side cursor
--      filter uses only `created_at < cursor_at`. The RPC uses
--      tuple comparison `(c.created_at, c.id) < (v_cursor_at, p_cursor)`
--      so the id breaks the tie cleanly. Also folds in the prior
--      assertDeckOwnership SELECT, cutting one round-trip.
--
--   B. get_session_summary — replaces 3 SELECTs + JS aggregation
--      in review.service.getSessionSummary with one RPC returning
--      a JSONB envelope (aggregate stats + leeches with card lookup
--      already joined).
-- =============================================================


-- ─── A. list_cards_paginated ──────────────────────────────────────────────────

CREATE FUNCTION list_cards_paginated(
  p_user_id        UUID,
  p_deck_id        UUID,
  p_limit          INT,
  p_cursor         UUID DEFAULT NULL,
  p_status_filter  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  fields_data  JSONB,
  layout_type  public.layout_type,
  card_type    public.card_type,
  jlpt_level   public.jlpt_level,
  state        INT,
  is_suspended BOOLEAN,
  due          TIMESTAMPTZ,
  tags         TEXT[]
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cursor_at TIMESTAMPTZ;
BEGIN
  -- Deck ownership check (formerly assertDeckOwnership in JS).
  IF NOT EXISTS (
    SELECT 1 FROM public.decks d
    WHERE d.id = p_deck_id AND d.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified deck does not exist or does not belong to this user.';
  END IF;

  -- Resolve cursor → (created_at, id) tuple. Scope to the user so a stale or
  -- foreign cursor leaks no info (matches the prior JS behaviour).
  IF p_cursor IS NOT NULL THEN
    SELECT c.created_at INTO v_cursor_at
    FROM public.cards c
    WHERE c.id = p_cursor
      AND c.user_id = p_user_id;
    -- If cursor doesn't resolve, v_cursor_at stays NULL and the WHERE
    -- predicate below short-circuits to "no cursor filter".
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.fields_data, c.layout_type, c.card_type, c.jlpt_level,
    c.state, c.is_suspended, c.due, c.tags
  FROM public.cards c
  WHERE c.deck_id = p_deck_id
    AND c.user_id = p_user_id
    AND (
      p_status_filter IS NULL
      OR p_status_filter = 'all'
      OR (p_status_filter = 'new'       AND c.state = 0       AND c.is_suspended = FALSE)
      OR (p_status_filter = 'learning'  AND c.state IN (1, 3) AND c.is_suspended = FALSE)
      OR (p_status_filter = 'review'    AND c.state = 2       AND c.is_suspended = FALSE)
      OR (p_status_filter = 'suspended' AND c.is_suspended = TRUE)
    )
    AND (
      v_cursor_at IS NULL
      -- Tuple compare: with ORDER BY created_at DESC, id DESC, "next page"
      -- means rows strictly less than the cursor's (created_at, id). Fixes
      -- the boundary skip when same-created_at neighbours straddled the cursor.
      OR (c.created_at, c.id) < (v_cursor_at, p_cursor)
    )
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION list_cards_paginated(UUID, UUID, INT, UUID, TEXT) TO service_role;


-- ─── B. get_session_summary ───────────────────────────────────────────────────
-- Body returns a JSONB envelope reshaped by the JS layer into the
-- existing SessionSummary wire format. Internal LIMIT 5000 caps the
-- review_logs scan defensively — way above any realistic session size.

CREATE FUNCTION get_session_summary(
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
  -- Aggregate stats from review_logs (capped at 5000 rows for safety).
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
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.leeches l
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

  -- Re-run the CTE chain so jsonb_build_object can reference both agg and leeches.
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
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.leeches l
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
    'leeches',       COALESCE(
                       (SELECT jsonb_agg(jsonb_build_object(
                          'leech_id',     l.leech_id,
                          'card_id',      l.card_id,
                          'deck_id',      l.deck_id,
                          'word',         l.word,
                          'reading',      l.reading,
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

GRANT EXECUTE ON FUNCTION get_session_summary(UUID, UUID) TO service_role;
