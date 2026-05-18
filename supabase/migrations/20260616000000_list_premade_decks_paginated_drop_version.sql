-- =============================================================
-- Migration: 20260616000000_list_premade_decks_paginated_drop_version.sql
--
-- Corrects a dangling column reference in list_premade_decks_paginated.
--
-- Background: migration 20260523000000_list_pagination_cursor_hardening.sql
-- (re)defined `list_premade_decks_paginated` with `pd.version` in both the
-- RETURNS TABLE signature and the SELECT projection. Migration
-- 20260607000000_premade_copy_model.sql then dropped the
-- `premade_decks.version` column (Backend Completion Plan Stage 4 — copy
-- model has no notion of a tracked version). Because PL/pgSQL bodies are
-- opaque to Postgres's dependency tracker, the DROP COLUMN applied
-- cleanly without forcing a redefinition of this function. The result is
-- that any call to list_premade_decks_paginated on a freshly migrated
-- database fails with:
--
--   column pd.version does not exist  (SQLSTATE 42703)
--
-- and `GET /api/v1/premade-decks` raises a 500 — the symptom that wedged
-- the `/decks/premade` catalogue (the page renders the empty state
-- because `apiCallSafe` swallows the 5xx into its fallback).
--
-- This migration redefines the function without that column. The service
-- layer (apps/api/src/services/premade.service.ts) and the wire schema
-- (packages/shared-types/src/schemas/api.schema.ts:128) already treat
-- `version` as removed — see the comment at api.schema.ts:136 ("`version`
-- removed in Backend Completion Plan Stage 4"). After this migration
-- applies, the RPC's RETURNS TABLE shape matches the
-- PremadeDeckListRpcRowSchema shape the service already parses against.
--
-- No data backfill required. The function reads premade_decks only and
-- was never the source of truth for the dropped column.
--
-- DROP+CREATE rather than CREATE OR REPLACE: PostgreSQL forbids
-- changing a function's RETURNS TABLE signature in place. The GRANT
-- EXECUTE … TO service_role is re-issued (Supabase's auto-grant doesn't
-- fire for `supabase db push`).
--
-- This is the same class of bug as the one fixed by
-- 20260613000000_list_decks_paginated_drop_premade_fork.sql; this
-- migration applies the same remedy to its sibling RPC.
-- =============================================================

DROP FUNCTION IF EXISTS public.list_premade_decks_paginated(
  INT, UUID, public.deck_type, public.jlpt_level, TEXT
);

CREATE FUNCTION public.list_premade_decks_paginated(
  p_limit      INT,
  p_cursor     UUID              DEFAULT NULL,
  p_deck_type  public.deck_type  DEFAULT NULL,
  p_jlpt_level public.jlpt_level DEFAULT NULL,
  p_domain     TEXT              DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  description TEXT,
  deck_type   public.deck_type,
  jlpt_level  public.jlpt_level,
  domain      TEXT,
  card_count  INT,
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cursor_jlpt    public.jlpt_level;
  v_cursor_name    TEXT;
  v_cursor_created TIMESTAMPTZ;
BEGIN
  -- Resolve cursor → (jlpt_level, name, created_at) tuple from a public
  -- premade row. Premade decks are global (no user scope); we still gate
  -- on is_active so an inactivated cursor doesn't leak its existence.
  IF p_cursor IS NOT NULL THEN
    SELECT pd.jlpt_level, pd.name, pd.created_at
    INTO v_cursor_jlpt, v_cursor_name, v_cursor_created
    FROM public.premade_decks pd
    WHERE pd.id = p_cursor
      AND pd.is_active = TRUE;
  END IF;

  RETURN QUERY
  SELECT
    pd.id,
    pd.name,
    pd.description,
    pd.deck_type,
    pd.jlpt_level,
    pd.domain,
    pd.card_count,
    pd.is_active,
    pd.created_at,
    pd.updated_at
  FROM public.premade_decks pd
  WHERE pd.is_active = TRUE
    AND (p_deck_type  IS NULL OR pd.deck_type  = p_deck_type)
    AND (p_jlpt_level IS NULL OR pd.jlpt_level = p_jlpt_level)
    AND (p_domain     IS NULL OR pd.domain     = p_domain)
    AND (
      v_cursor_name IS NULL
      -- ORDER BY (jlpt_level ASC NULLS LAST, name ASC, created_at ASC, id ASC)
      -- → "next page" is rows strictly greater than the cursor's tuple.
      -- COALESCE on jlpt_level keeps NULL → NULLS LAST consistent across
      -- both ORDER BY and the comparison. created_at + id form an
      -- immutable tail that breaks ties even if (jlpt_level, name)
      -- ever differ between cursor issuance and follow-up requests.
      OR (
        COALESCE(pd.jlpt_level::TEXT, '~'),
        pd.name,
        pd.created_at,
        pd.id
      ) > (
        COALESCE(v_cursor_jlpt::TEXT, '~'),
        v_cursor_name,
        v_cursor_created,
        p_cursor
      )
    )
  ORDER BY pd.jlpt_level ASC NULLS LAST, pd.name ASC, pd.created_at ASC, pd.id ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_premade_decks_paginated(
  INT, UUID, public.deck_type, public.jlpt_level, TEXT
) TO service_role;
