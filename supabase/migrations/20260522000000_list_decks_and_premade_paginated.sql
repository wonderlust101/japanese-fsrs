-- =============================================================
-- Migration: 20260522000000_list_decks_and_premade_paginated.sql
--
-- Two new pagination RPCs matching the existing list_cards_paginated
-- pattern (migration 20260516000000). Both folded into the universal
-- list-envelope rollout — see Track B of the API contract cleanup.
--
--   A. list_decks_paginated(p_user_id, p_limit, p_cursor)
--      Replaces the bare SELECT in deck.service.listDecks.
--      Order: (updated_at DESC, id DESC) so two decks updated in the
--      same batch don't drop out at page boundaries.
--
--   B. list_premade_decks_paginated(p_limit, p_cursor, p_deck_type, p_jlpt_level, p_domain)
--      Replaces the bare SELECT in premade.service.listPremadeDecks.
--      Order: (jlpt_level ASC NULLS LAST, name ASC, id ASC).
--      Filters: is_active = TRUE (always), plus optional deck_type/jlpt_level/domain.
--
-- Both functions:
--   • SECURITY DEFINER with `SET search_path = ''` and fully-qualified refs
--   • explicit GRANT EXECUTE … TO service_role
--   • cursor scoped to the caller (decks RPC) so a stale or foreign cursor
--     leaks no info
-- =============================================================


-- ─── A. list_decks_paginated ──────────────────────────────────────────────────

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
  -- Resolve cursor → updated_at. Scope to the caller so a foreign cursor
  -- silently degrades to "no cursor" rather than leaking deck existence.
  IF p_cursor IS NOT NULL THEN
    SELECT d.updated_at INTO v_cursor_at
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
      -- ORDER BY (updated_at DESC, id DESC) → "next page" is rows strictly
      -- less than the cursor's tuple, identical to list_cards_paginated.
      OR (d.updated_at, d.id) < (v_cursor_at, p_cursor)
    )
  ORDER BY d.updated_at DESC, d.id DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION list_decks_paginated(UUID, INT, UUID) TO service_role;


-- ─── B. list_premade_decks_paginated ──────────────────────────────────────────

CREATE FUNCTION list_premade_decks_paginated(
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
  v_cursor_jlpt public.jlpt_level;
  v_cursor_name TEXT;
BEGIN
  -- Resolve cursor → (jlpt_level, name) tuple from a public premade row.
  -- Premade decks are global (no user scope), so the cursor doesn't need
  -- a user predicate; we still gate on is_active so an inactivated cursor
  -- doesn't leak its existence.
  IF p_cursor IS NOT NULL THEN
    SELECT pd.jlpt_level, pd.name
    INTO v_cursor_jlpt, v_cursor_name
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
      -- ORDER BY (jlpt_level ASC, name ASC, id ASC) → "next page" is rows
      -- strictly greater than the cursor's tuple. NULL jlpt_level is rare
      -- (only beyond_jlpt + null mix) but the tuple comparison handles it
      -- consistently with the ORDER BY's NULLS LAST behaviour because we
      -- coalesce it for the comparison.
      OR (
        COALESCE(pd.jlpt_level::TEXT, '~'),
        pd.name,
        pd.id
      ) > (
        COALESCE(v_cursor_jlpt::TEXT, '~'),
        v_cursor_name,
        p_cursor
      )
    )
  ORDER BY pd.jlpt_level ASC NULLS LAST, pd.name ASC, pd.id ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION list_premade_decks_paginated(
  INT, UUID, public.deck_type, public.jlpt_level, TEXT
) TO service_role;
