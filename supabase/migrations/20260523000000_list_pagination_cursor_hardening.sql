-- =============================================================
-- Migration: 20260523000000_list_pagination_cursor_hardening.sql
--
-- Hardens cursor pagination on the two RPCs added in migration
-- 20260522000000 so the cursor sorts over immutable keys. Forward-only
-- per CLAUDE.md — both functions are recreated via CREATE OR REPLACE,
-- which preserves the existing GRANT EXECUTE … TO service_role.
--
--   A. list_decks_paginated — was ordered by (updated_at DESC, id DESC).
--      `updated_at` is mutated by every PATCH /decks/:id, so a deck
--      edited mid-pagination could shift past the cursor and either
--      duplicate in the next page or be skipped. Now ordered by
--      (created_at DESC, id DESC) — both columns are immutable.
--
--   B. list_premade_decks_paginated — primary sort stays
--      (jlpt_level ASC NULLS LAST, name ASC) so the JLPT-grouped
--      visual ordering is preserved, but the tuple is extended with
--      (created_at ASC, id ASC). Premade decks are operationally
--      immutable today (publishers don't rename), so the head keys
--      are effectively frozen; the immutable tail makes the cursor
--      provably stable for any future ties on (jlpt_level, name).
-- =============================================================


-- ─── A. list_decks_paginated ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION list_decks_paginated(
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


-- ─── B. list_premade_decks_paginated ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION list_premade_decks_paginated(
  p_limit      INT,
  p_cursor     UUID DEFAULT NULL,
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
  version     INT,
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
    pd.version,
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
