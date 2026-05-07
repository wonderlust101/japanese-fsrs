-- =============================================================
-- Migration: 20260527000000_list_decks_paginated_include_version.sql
--
-- Adds `version INT` to the return signature of list_decks_paginated.
-- Migration 20260526000000 added the `version` column to public.decks
-- for optimistic concurrency, and ApiDeckSchema (shared-types) now
-- requires `version` on every full-resource response — but the RPC
-- defined in 20260522000000 / hardened in 20260523000000 was never
-- re-projected to include it. As a result every GET /api/v1/decks
-- fails Zod parsing in deck.service.ts → DeckListRpcRowSchema with
-- `Invalid input: expected number, received undefined` at [0, "version"].
--
-- DROP+CREATE rather than CREATE OR REPLACE: PostgreSQL forbids
-- changing a function's RETURNS TABLE signature in place. The
-- explicit GRANT EXECUTE … TO service_role is re-issued (Supabase's
-- auto-grant doesn't fire for `supabase db push`).
--
-- Body and ordering are unchanged from 20260523000000 — the only
-- additions are `version INT` in RETURNS TABLE and `d.version` in
-- the SELECT projection.
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
  updated_at        TIMESTAMPTZ
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
  SELECT
    d.id,
    d.name,
    d.description,
    d.deck_type,
    d.is_premade_fork,
    d.source_premade_id,
    d.card_count,
    d.version,
    d.created_at,
    d.updated_at
  FROM public.decks d
  WHERE d.user_id = p_user_id
    AND (
      v_cursor_at IS NULL
      -- ORDER BY (created_at DESC, id DESC) → "next page" is rows strictly
      -- less than the cursor's tuple. Both keys are immutable → cursor is
      -- stable across concurrent UPDATEs.
      OR (d.created_at, d.id) < (v_cursor_at, p_cursor)
    )
  ORDER BY d.created_at DESC, d.id DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION list_decks_paginated(UUID, INT, UUID) TO service_role;
