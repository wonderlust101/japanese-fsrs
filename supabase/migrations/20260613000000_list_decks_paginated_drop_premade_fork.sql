-- =============================================================
-- Migration: 20260613000000_list_decks_paginated_drop_premade_fork.sql
--
-- Corrects a dangling column reference in list_decks_paginated.
--
-- Background: migration 20260606000000_list_decks_paginated_rollups.sql
-- defined list_decks_paginated as a PL/pgSQL function that references
-- decks.is_premade_fork in its RETURNS TABLE signature, the page_decks
-- CTE projection, and the outer SELECT. Migration
-- 20260607000000_premade_copy_model.sql then dropped the
-- decks.is_premade_fork column (Backend Completion Plan Stage 4 — copy
-- model replaces the subscription model). Because PL/pgSQL bodies are
-- opaque to Postgres's dependency tracker, the DROP COLUMN applied
-- cleanly without forcing a redefinition of this function. The result
-- is that any call to list_decks_paginated on a freshly migrated
-- database fails with:
--
--   column d.is_premade_fork does not exist
--
-- This migration redefines the function without that column. No data
-- backfill is required; the function reads decks/cards only and was
-- never the source of truth for the dropped column.
--
-- The service layer (apps/api/src/services/deck.service.ts) and the
-- wire schema (packages/shared-types/src/schemas/api.schema.ts) already
-- treat is_premade_fork as removed — see the comments in
-- deck.service.ts:22, deck.service.ts:51, and api.schema.ts:102. After
-- this migration applies, the RPC's RETURNS TABLE shape matches the
-- ApiDeckWithStatsSchema shape the service is already consuming.
--
-- DROP+CREATE rather than CREATE OR REPLACE: PostgreSQL forbids
-- changing a function's RETURNS TABLE signature in place. GRANT
-- EXECUTE … TO service_role is re-issued (Supabase's auto-grant
-- doesn't fire for `supabase db push`).
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
