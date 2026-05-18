-- =============================================================
-- Migration: 20260617000000_list_cards_cross_deck_rpc.sql
--
-- Adds `list_cards_cross_deck` — the cross-deck card browser RPC
-- powering `GET /api/v1/cards/cross-deck` (the /cards page). Differs
-- from `list_cards_paginated` in three ways:
--
--   1. No deck-scoping filter at the predicate level: rows are filtered
--      to the caller's owned cards (`c.user_id = p_user_id`) and then
--      optionally narrowed by `p_deck_id`. The existing per-deck endpoint
--      stays unchanged for the deck-detail page.
--
--   2. JOIN to `decks` so the result projection carries `deck_name`. The
--      browser table renders one row per card across many decks; pulling
--      the name in this RPC avoids an N+1 deck lookup on the JS side.
--
--   3. Three sort modes (`recent` / `due` / `lapses`) with tuple-based
--      cursor pagination. The cursor is the previous page's last card id;
--      the RPC looks up the row's sort-key value internally so the JS
--      layer doesn't need to encode mode-specific payloads.
--
-- Filter dimensions:
--   p_deck_id        — optional deck scope (NULL = all of the user's decks).
--   p_status         — 'all' | 'new' | 'learning' | 'review' | 'suspended'.
--   p_jlpt_level     — 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond'.
--                      'beyond' matches both `beyond_jlpt` and NULL — the
--                      product semantics ("no JLPT level inferred") cover
--                      both shapes.
--   p_search         — case-insensitive substring on word/reading/meaning.
--                      ILIKE-based: a trigram index can be added later if
--                      perf bites.
--   p_missing_field  — 'reading' | 'meaning' | 'example' | 'mnemonic' |
--                      'picture' | 'nuance' (deep links from the quality
--                      bars). Sentence-layout cards are excluded from the
--                      missing-field filters because their fields_data
--                      shape is intentionally open.
--   p_sort           — 'recent' (default), 'due', 'lapses'.
--
-- Premade source cards (user_id IS NULL) are never returned — the cross-
-- deck browser only shows the learner's personal copies.
-- =============================================================

CREATE FUNCTION public.list_cards_cross_deck(
  p_user_id        UUID,
  p_limit          INT,
  p_cursor         UUID    DEFAULT NULL,
  p_deck_id        UUID    DEFAULT NULL,
  p_status         TEXT    DEFAULT NULL,
  p_jlpt_level     TEXT    DEFAULT NULL,
  p_search         TEXT    DEFAULT NULL,
  p_missing_field  TEXT    DEFAULT NULL,
  p_sort           TEXT    DEFAULT 'recent'
)
RETURNS TABLE (
  id           UUID,
  deck_id      UUID,
  deck_name    TEXT,
  fields_data  JSONB,
  layout_type  public.layout_type,
  jlpt_level   public.jlpt_level,
  state        INT,
  is_suspended BOOLEAN,
  due          TIMESTAMPTZ,
  tags         TEXT[],
  lapses       INT,
  created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cursor_created_at TIMESTAMPTZ;
  v_cursor_due        TIMESTAMPTZ;
  v_cursor_lapses     INT;
  v_sort              TEXT := COALESCE(p_sort, 'recent');
  v_search_pattern    TEXT;
BEGIN
  IF v_sort NOT IN ('recent', 'due', 'lapses') THEN
    RAISE EXCEPTION 'invalid_sort'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_sort must be one of: recent, due, lapses.';
  END IF;

  -- Resolve cursor → sort-key values. Scoping the lookup to the caller
  -- means a stale or foreign cursor degrades silently to "no cursor".
  IF p_cursor IS NOT NULL THEN
    SELECT c.created_at, c.due, c.lapses
      INTO v_cursor_created_at, v_cursor_due, v_cursor_lapses
    FROM public.cards c
    WHERE c.id = p_cursor
      AND c.user_id = p_user_id;
  END IF;

  -- Build the ILIKE pattern once. The escape character (`\`) is forced
  -- via Postgres default; `%` and `_` in user input are accepted as
  -- wildcards (matches the spirit of substring search and is safe — no
  -- SQL injection vector here since we go through a bound parameter).
  IF p_search IS NOT NULL AND length(p_search) > 0 THEN
    v_search_pattern := '%' || lower(p_search) || '%';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.deck_id, d.name AS deck_name, c.fields_data, c.layout_type,
    c.jlpt_level, c.state, c.is_suspended, c.due, c.tags, c.lapses,
    c.created_at
  FROM public.cards c
  JOIN public.decks d ON d.id = c.deck_id
  WHERE c.user_id = p_user_id
    AND (p_deck_id IS NULL OR c.deck_id = p_deck_id)
    AND (
      p_status IS NULL
      OR p_status = 'all'
      OR (p_status = 'new'       AND c.state = 0       AND c.is_suspended = FALSE)
      OR (p_status = 'learning'  AND c.state IN (1, 3) AND c.is_suspended = FALSE)
      OR (p_status = 'review'    AND c.state = 2       AND c.is_suspended = FALSE)
      OR (p_status = 'suspended' AND c.is_suspended = TRUE)
    )
    AND (
      p_jlpt_level IS NULL
      OR p_jlpt_level = 'all'
      OR (p_jlpt_level = 'beyond' AND (c.jlpt_level IS NULL OR c.jlpt_level = 'beyond_jlpt'))
      OR (p_jlpt_level NOT IN ('all', 'beyond') AND c.jlpt_level::TEXT = p_jlpt_level)
    )
    AND (
      v_search_pattern IS NULL
      OR lower(c.fields_data ->> 'word')    LIKE v_search_pattern
      OR lower(c.fields_data ->> 'reading') LIKE v_search_pattern
      OR lower(c.fields_data ->> 'meaning') LIKE v_search_pattern
    )
    AND (
      p_missing_field IS NULL
      OR c.layout_type IN ('vocabulary', 'grammar')
    )
    AND (
      p_missing_field IS NULL
      OR (p_missing_field = 'reading'
            AND (c.fields_data ->> 'reading' IS NULL OR c.fields_data ->> 'reading' = ''))
      OR (p_missing_field = 'meaning'
            AND (c.fields_data ->> 'meaning' IS NULL OR c.fields_data ->> 'meaning' = ''))
      OR (p_missing_field = 'example'
            AND (NOT (c.fields_data ? 'exampleSentences')
                 OR jsonb_typeof(c.fields_data -> 'exampleSentences') <> 'array'
                 OR jsonb_array_length(c.fields_data -> 'exampleSentences') = 0))
      OR (p_missing_field = 'mnemonic'
            AND (c.fields_data ->> 'mnemonic' IS NULL OR c.fields_data ->> 'mnemonic' = ''))
      OR (p_missing_field = 'picture'
            AND (c.fields_data ->> 'picture' IS NULL OR c.fields_data ->> 'picture' = ''))
      OR (p_missing_field = 'nuance'
            AND (c.fields_data ->> 'nuance' IS NULL OR c.fields_data ->> 'nuance' = ''))
    )
    AND (
      -- Cursor pagination. The tuple compare uses the same column the
      -- ORDER BY does so the planner can use a matching index path.
      p_cursor IS NULL
      OR v_cursor_created_at IS NULL  -- foreign / stale cursor → ignore
      OR (v_sort = 'recent' AND (c.created_at, c.id) < (v_cursor_created_at, p_cursor))
      OR (v_sort = 'due'    AND (c.due, c.id)        > (v_cursor_due,        p_cursor))
      OR (v_sort = 'lapses' AND (c.lapses, c.id)     < (v_cursor_lapses,     p_cursor))
    )
  ORDER BY
    -- Branch on sort mode. Postgres can't index expressions of the form
    -- CASE WHEN p_sort = … ELSE … END, but the three explicit clauses are
    -- evaluated cheaply (constant per query) and the planner picks the
    -- right column.
    CASE WHEN v_sort = 'recent' THEN c.created_at END DESC,
    CASE WHEN v_sort = 'due'    THEN c.due        END ASC,
    CASE WHEN v_sort = 'lapses' THEN c.lapses     END DESC,
    c.id DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Cross-deck card browser RPC. Returns one row per personal card across all
   of the caller''s decks, joined to decks.name. Supports search, deck/jlpt/
   status/missing-field filters, three sort modes, and tuple-based cursor
   pagination. Premade source cards (user_id IS NULL) are never returned.';

-- =============================================================
-- Total-count companion: a separate RPC keeps the listing fast (LIMIT-bounded)
-- while letting the browser show "X cards" without a follow-up COUNT(*).
-- Same filter surface, no cursor / sort / limit.
-- =============================================================

CREATE FUNCTION public.count_cards_cross_deck(
  p_user_id        UUID,
  p_deck_id        UUID    DEFAULT NULL,
  p_status         TEXT    DEFAULT NULL,
  p_jlpt_level     TEXT    DEFAULT NULL,
  p_search         TEXT    DEFAULT NULL,
  p_missing_field  TEXT    DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_search_pattern TEXT;
  v_count          INT;
BEGIN
  IF p_search IS NOT NULL AND length(p_search) > 0 THEN
    v_search_pattern := '%' || lower(p_search) || '%';
  END IF;

  SELECT COUNT(*)::INT
    INTO v_count
  FROM public.cards c
  WHERE c.user_id = p_user_id
    AND (p_deck_id IS NULL OR c.deck_id = p_deck_id)
    AND (
      p_status IS NULL
      OR p_status = 'all'
      OR (p_status = 'new'       AND c.state = 0       AND c.is_suspended = FALSE)
      OR (p_status = 'learning'  AND c.state IN (1, 3) AND c.is_suspended = FALSE)
      OR (p_status = 'review'    AND c.state = 2       AND c.is_suspended = FALSE)
      OR (p_status = 'suspended' AND c.is_suspended = TRUE)
    )
    AND (
      p_jlpt_level IS NULL
      OR p_jlpt_level = 'all'
      OR (p_jlpt_level = 'beyond' AND (c.jlpt_level IS NULL OR c.jlpt_level = 'beyond_jlpt'))
      OR (p_jlpt_level NOT IN ('all', 'beyond') AND c.jlpt_level::TEXT = p_jlpt_level)
    )
    AND (
      v_search_pattern IS NULL
      OR lower(c.fields_data ->> 'word')    LIKE v_search_pattern
      OR lower(c.fields_data ->> 'reading') LIKE v_search_pattern
      OR lower(c.fields_data ->> 'meaning') LIKE v_search_pattern
    )
    AND (
      p_missing_field IS NULL
      OR c.layout_type IN ('vocabulary', 'grammar')
    )
    AND (
      p_missing_field IS NULL
      OR (p_missing_field = 'reading'
            AND (c.fields_data ->> 'reading' IS NULL OR c.fields_data ->> 'reading' = ''))
      OR (p_missing_field = 'meaning'
            AND (c.fields_data ->> 'meaning' IS NULL OR c.fields_data ->> 'meaning' = ''))
      OR (p_missing_field = 'example'
            AND (NOT (c.fields_data ? 'exampleSentences')
                 OR jsonb_typeof(c.fields_data -> 'exampleSentences') <> 'array'
                 OR jsonb_array_length(c.fields_data -> 'exampleSentences') = 0))
      OR (p_missing_field = 'mnemonic'
            AND (c.fields_data ->> 'mnemonic' IS NULL OR c.fields_data ->> 'mnemonic' = ''))
      OR (p_missing_field = 'picture'
            AND (c.fields_data ->> 'picture' IS NULL OR c.fields_data ->> 'picture' = ''))
      OR (p_missing_field = 'nuance'
            AND (c.fields_data ->> 'nuance' IS NULL OR c.fields_data ->> 'nuance' = ''))
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_cards_cross_deck(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.count_cards_cross_deck(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT
) IS
  'Total matching count for the cross-deck browser. Same filter surface as
   list_cards_cross_deck minus pagination/sort, so the table footer can show
   "X cards" without paging through every row.';
