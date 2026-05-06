-- =============================================================
-- Migration: 20260519000000_leech_cascade_and_premade_doc.sql
--
-- A. leeches.card_id ON DELETE CASCADE → SET NULL
--    Mirrors the pattern that review_logs.card_id adopted in 20260504000004 C2.
--    Both are conceptually history tables tied to cards; the prior asymmetry
--    (review_logs preserves history on card delete, leeches loses it) was
--    unintentional. Switching preserves AI-generated diagnosis text and the
--    (user_id, session_id, created_at) shape for future leech analytics.
--
-- B. get_session_summary — orphan-leech filter
--    The session-summary UI builds a `/decks/:deckId/cards/:cardId` link from
--    each leech. Orphans (whose card has been hard-deleted) have nothing
--    actionable to show, so the RPC filters `card_id IS NOT NULL` in the
--    leeches CTE. The orphan rows remain in `leeches` for any future
--    analytics view that wants them.
--
-- C. premade_decks.is_active comment
--    Documents that this is the canonical lifecycle (no hard-delete in normal
--    ops) so the cascade asymmetry between FK #3 (decks.source_premade_id
--    SET NULL) and FK #5 (user_premade_subscriptions.premade_deck_id CASCADE)
--    is self-explanatory to future maintainers.
-- =============================================================


-- ─── A. leeches.card_id FK switch ────────────────────────────────────────────

ALTER TABLE leeches DROP CONSTRAINT leeches_card_id_fkey;

ALTER TABLE leeches ALTER COLUMN card_id DROP NOT NULL;

ALTER TABLE leeches
  ADD CONSTRAINT leeches_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;

-- The unique partial leeches_card_user_unresolved_idx (card_id, user_id) WHERE
-- resolved = FALSE is unaffected: PG treats NULL as distinct in unique
-- constraints, so multiple orphan-leech rows with card_id = NULL and the same
-- user_id and resolved = FALSE are allowed (which is correct — they don't
-- logically conflict). Simple leeches_card_id_idx and the partial
-- leeches_user_id_unresolved_idx need no changes.


-- ─── B. get_session_summary — filter orphan leeches ─────────────────────────
-- Body identical to the version in 20260516000000 except the leeches_with_cards
-- CTE adds AND l.card_id IS NOT NULL. Internal LIMIT 5000 cap on the review_logs
-- scan is preserved.

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
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.leeches l
    JOIN public.cards c ON c.id = l.card_id
    WHERE l.session_id  = p_session_id
      AND l.user_id     = p_user_id
      AND l.card_id IS NOT NULL
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


-- ─── C. premade_decks.is_active lifecycle comment ────────────────────────────

COMMENT ON COLUMN premade_decks.is_active IS
  'Catalog visibility flag — the canonical lifecycle. Premade decks are NEVER hard-deleted in normal ops; this boolean is toggled instead. The asymmetry between FK #3 (decks.source_premade_id ON DELETE SET NULL) and FK #5 (user_premade_subscriptions.premade_deck_id ON DELETE CASCADE) only matters during admin/ops cleanup and is intentional: a hard-deleted premade leaves user forks alive but unmoors the subscription tracking row.';
