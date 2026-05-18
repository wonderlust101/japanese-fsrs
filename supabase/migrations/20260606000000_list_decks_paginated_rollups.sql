-- =============================================================
-- Migration: 20260606000000_list_decks_paginated_rollups.sql
--
-- Extends list_decks_paginated's RETURNS TABLE signature with six
-- per-deck rollup columns so GET /api/v1/decks can render the
-- dashboard ("X due, Y new, Z mature, last reviewed N days ago")
-- in one round-trip — eliminating the N+1 fanout that today fires
-- one getDeck call per visible deck on /today and /decks.
--
-- Added columns:
--   due_count         — cards due now (due <= NOW) and not suspended
--   new_count         — cards in state = New (0); not bounded by is_suspended,
--                       matches getDeck's existing newCount semantics
--   mature_count      — graduated cards: state = Review (2) AND
--                       scheduled_days >= 21 AND not suspended
--                       (Anki convention; mirrors getDeck)
--   due_new_count     — subset of due_count: state = New
--   due_review_count  — subset of due_count: state != New (Learning /
--                       Review / Relearning)
--   last_reviewed_at  — MAX(cards.last_review) per deck, or NULL when
--                       no card in the deck has been reviewed yet
--
-- Implementation strategy:
--   1. Page the user's decks into a CTE (cursor pagination unchanged).
--   2. Single GROUP BY aggregate over `cards` filtered to the
--      page's deck IDs — produces one row per page-deck with all six
--      rollups via FILTER clauses. Uses the existing cards_deck_id_idx
--      to drive the deck-id slice and the user_id filter to prune
--      the user's rows.
--   3. LEFT JOIN page_decks ⟕ rollups, COALESCE NULLs to 0 for the
--      counts (a deck with zero cards still belongs in the response).
--
-- last_reviewed_at is read from cards.last_review (kept fresh by
-- process_review) rather than joining review_logs — saves a table
-- crossing and keeps the aggregate inside one indexable predicate.
--
-- DROP+CREATE rather than CREATE OR REPLACE: PostgreSQL forbids
-- changing a function's RETURNS TABLE signature in place. The
-- explicit GRANT EXECUTE … TO service_role is re-issued (Supabase's
-- auto-grant doesn't fire for `supabase db push`).
-- =============================================================

DROP FUNCTION list_decks_paginated(UUID, INT, UUID);

CREATE FUNCTION list_decks_paginated(
  p_user_id UUID,
  p_limit   INT,
  p_cursor  UUID DEFAULT NULL
)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  description       TEXT,
  deck_type         public.deck_type,
  is_premade_fork   BOOLEAN,
  source_premade_id UUID,
  card_count        INT,
  version           INT,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  due_count         INT,
  new_count         INT,
  mature_count      INT,
  due_new_count     INT,
  due_review_count  INT,
  last_reviewed_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cursor_at TIMESTAMPTZ;
BEGIN
  -- Resolve cursor → created_at. Scope to the caller so a foreign cursor
  -- silently degrades to "no cursor" rather than leaking deck existence.
  IF p_cursor IS NOT NULL THEN
    SELECT d.created_at INTO v_cursor_at
    FROM public.decks d
    WHERE d.id = p_cursor
      AND d.user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH page_decks AS (
    -- Cursor-paginated slice — identical semantics to the pre-Stage-3
    -- function body. The window is small (LIMIT bounded by request),
    -- so the downstream aggregate operates on at most p_limit deck IDs.
    SELECT
      d.id                AS id,
      d.name              AS name,
      d.description       AS description,
      d.deck_type         AS deck_type,
      d.is_premade_fork   AS is_premade_fork,
      d.source_premade_id AS source_premade_id,
      d.card_count        AS card_count,
      d.version           AS version,
      d.created_at        AS created_at,
      d.updated_at        AS updated_at
    FROM public.decks d
    WHERE d.user_id = p_user_id
      AND (
        v_cursor_at IS NULL
        OR (d.created_at, d.id) < (v_cursor_at, p_cursor)
      )
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT p_limit
  ),
  rollups AS (
    -- One scan of `cards` filtered to the page's deck IDs. The user_id
    -- predicate prunes to the caller's rows so premade source cards
    -- (user_id IS NULL) never count toward the user's rollups.
    -- COUNT(*) FILTER (…) is a postgres idiom for conditional counts in
    -- one pass; planner emits a single Aggregate node over the deck slice.
    SELECT
      c.deck_id                                                                                                    AS deck_id,
      COUNT(*) FILTER (WHERE c.due <= NOW() AND c.is_suspended = FALSE)                              ::INT          AS due_count,
      COUNT(*) FILTER (WHERE c.state = 0)                                                            ::INT          AS new_count,
      COUNT(*) FILTER (WHERE c.state = 2 AND c.scheduled_days >= 21 AND c.is_suspended = FALSE)      ::INT          AS mature_count,
      COUNT(*) FILTER (WHERE c.due <= NOW() AND c.is_suspended = FALSE AND c.state = 0)              ::INT          AS due_new_count,
      COUNT(*) FILTER (WHERE c.due <= NOW() AND c.is_suspended = FALSE AND c.state <> 0)             ::INT          AS due_review_count,
      MAX(c.last_review)                                                                                            AS last_reviewed_at
    FROM public.cards c
    WHERE c.user_id = p_user_id
      AND c.deck_id IN (SELECT pd.id FROM page_decks pd)
    GROUP BY c.deck_id
  )
  SELECT
    pd.id,
    pd.name,
    pd.description,
    pd.deck_type,
    pd.is_premade_fork,
    pd.source_premade_id,
    pd.card_count,
    pd.version,
    pd.created_at,
    pd.updated_at,
    -- COALESCE the COUNT outputs so a deck with no cards reports zero
    -- (the LEFT JOIN yields NULL rollups for those decks).
    COALESCE(r.due_count,        0) AS due_count,
    COALESCE(r.new_count,        0) AS new_count,
    COALESCE(r.mature_count,     0) AS mature_count,
    COALESCE(r.due_new_count,    0) AS due_new_count,
    COALESCE(r.due_review_count, 0) AS due_review_count,
    -- last_reviewed_at stays NULL when no card in the deck has been
    -- reviewed yet — semantically distinct from "0 reviews".
    r.last_reviewed_at
  FROM page_decks pd
  LEFT JOIN rollups r ON r.deck_id = pd.id
  -- LEFT JOIN does not preserve the inner CTE's ORDER BY; re-impose
  -- the cursor's tuple ordering on the outer projection.
  ORDER BY pd.created_at DESC, pd.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_decks_paginated(UUID, INT, UUID) TO service_role;
