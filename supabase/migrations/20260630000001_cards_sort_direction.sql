-- =============================================================
-- Migration: cards browser sort direction
-- Date:     2026-06-30
--
-- Extends `list_cards_cross_deck` with an explicit sort-direction
-- parameter so the UI can offer reverse sort on every axis. Each axis
-- keeps its existing "natural" default direction (recent = DESC, due =
-- ASC, lapses = DESC); passing NULL for p_sort_dir preserves
-- backwards-compatible behavior for any caller that hasn't yet been
-- updated.
--
-- Implementation notes:
--   * Postgres overloads functions by signature, so adding a new
--     parameter creates a new function. We DROP the old 11-param
--     variant inside the same migration to avoid two parallel
--     definitions diverging.
--   * Both the ORDER BY and the cursor tuple comparison must flip
--     when direction reverses. The CASE-per-direction pattern keeps
--     all branches as static SQL (Postgres can't accept a dynamic
--     direction keyword in ORDER BY).
--   * The c.id tiebreaker also flips with direction so cursor
--     pagination stays consistent across pages within the same
--     sort+direction combination.
--
-- See also:
--   * supabase/migrations/20260624000001_cards_browser_filter_relax_mutual_exclusion.sql
--     (the immediate predecessor; this file is identical except for
--     the new direction handling).
-- =============================================================

DROP FUNCTION IF EXISTS public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.list_cards_cross_deck(
  p_user_id        UUID,
  p_limit          INT,
  p_cursor         UUID    DEFAULT NULL,
  p_deck_id        UUID    DEFAULT NULL,
  p_status         TEXT    DEFAULT NULL,
  p_jlpt_level     TEXT    DEFAULT NULL,
  p_search         TEXT    DEFAULT NULL,
  p_missing_field  TEXT    DEFAULT NULL,
  p_sort           TEXT    DEFAULT 'recent',
  p_present_field  TEXT    DEFAULT NULL,
  p_pitch_pattern  TEXT    DEFAULT NULL,
  p_sort_dir       TEXT    DEFAULT NULL
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
  v_sort_dir          TEXT;
  v_search_pattern    TEXT;
BEGIN
  IF v_sort NOT IN ('recent', 'due', 'lapses') THEN
    RAISE EXCEPTION 'invalid_sort'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_sort must be one of: recent, due, lapses.';
  END IF;

  IF p_sort_dir IS NOT NULL AND p_sort_dir NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'invalid_sort_dir'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_sort_dir must be one of: asc, desc (or NULL for the per-axis natural default).';
  END IF;

  -- Resolve the effective direction. NULL means "use the natural
  -- default for this axis," which matches the pre-direction behavior:
  -- recent = newest first (DESC), due = soonest first (ASC), lapses =
  -- most first (DESC).
  v_sort_dir := COALESCE(p_sort_dir,
    CASE v_sort
      WHEN 'recent' THEN 'desc'
      WHEN 'due'    THEN 'asc'
      WHEN 'lapses' THEN 'desc'
    END
  );

  IF p_missing_field IS NOT NULL
     AND p_missing_field NOT IN ('reading', 'meaning', 'example', 'mnemonic', 'picture', 'nuance', 'pitch', 'audio') THEN
    RAISE EXCEPTION 'invalid_missing_field'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_missing_field must be one of: reading, meaning, example, mnemonic, picture, nuance, pitch, audio.';
  END IF;

  IF p_present_field IS NOT NULL
     AND p_present_field NOT IN ('picture', 'pitch', 'audio') THEN
    RAISE EXCEPTION 'invalid_present_field'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_present_field must be one of: picture, pitch, audio.';
  END IF;

  IF p_pitch_pattern IS NOT NULL
     AND p_pitch_pattern NOT IN ('heiban', 'atamadaka', 'nakadaka', 'odaka') THEN
    RAISE EXCEPTION 'invalid_pitch_pattern'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_pitch_pattern must be one of: heiban, atamadaka, nakadaka, odaka.';
  END IF;

  IF p_cursor IS NOT NULL THEN
    SELECT c.created_at, c.due, c.lapses
      INTO v_cursor_created_at, v_cursor_due, v_cursor_lapses
    FROM public.cards c
    WHERE c.id = p_cursor
      AND c.user_id = p_user_id;
  END IF;

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
      OR (p_missing_field = 'pitch'
            AND (c.fields_data ->> 'pitchPosition' IS NULL OR c.fields_data ->> 'pitchPosition' = '')
            AND (c.fields_data ->> 'pitchAccent'   IS NULL OR c.fields_data ->> 'pitchAccent'   = ''))
      OR (p_missing_field = 'audio'
            AND (c.fields_data ->> 'expressionAudio' IS NULL OR c.fields_data ->> 'expressionAudio' = ''))
    )
    AND (
      p_present_field IS NULL
      OR c.layout_type IN ('vocabulary', 'grammar')
    )
    AND (
      p_present_field IS NULL
      OR (p_present_field = 'picture'
            AND (c.fields_data ->> 'picture') IS NOT NULL
            AND (c.fields_data ->> 'picture') <> '')
      OR (p_present_field = 'pitch'
            AND (c.fields_data ->> 'pitchPosition') IS NOT NULL
            AND (c.fields_data ->> 'pitchPosition') <> '')
      OR (p_present_field = 'audio'
            AND (c.fields_data ->> 'expressionAudio') IS NOT NULL
            AND (c.fields_data ->> 'expressionAudio') <> '')
    )
    AND (
      p_pitch_pattern IS NULL
      OR (
        (c.fields_data ->> 'pitchPosition') IS NOT NULL
        AND (c.fields_data ->> 'pitchPosition') ~ '^[0-9]+$'
        AND (
          (p_pitch_pattern = 'heiban'    AND (c.fields_data ->> 'pitchPosition')::INT = 0)
          OR (p_pitch_pattern = 'atamadaka' AND (c.fields_data ->> 'pitchPosition')::INT = 1)
          OR (p_pitch_pattern = 'nakadaka'
                AND (c.fields_data ->> 'pitchPosition')::INT > 1
                AND (c.fields_data ->> 'pitchPosition')::INT < public.count_moras(c.fields_data ->> 'reading'))
          OR (p_pitch_pattern = 'odaka'
                AND (c.fields_data ->> 'pitchPosition')::INT > 1
                AND (c.fields_data ->> 'pitchPosition')::INT = public.count_moras(c.fields_data ->> 'reading'))
        )
      )
    )
    -- Cursor predicate. Tuple comparison flips with direction so the
    -- "next page" semantics stay correct: for DESC orderings we want
    -- the next row to be strictly less than the cursor's value; for
    -- ASC we want strictly greater.
    AND (
      p_cursor IS NULL
      OR v_cursor_created_at IS NULL
      OR (v_sort = 'recent' AND v_sort_dir = 'desc' AND (c.created_at, c.id) < (v_cursor_created_at, p_cursor))
      OR (v_sort = 'recent' AND v_sort_dir = 'asc'  AND (c.created_at, c.id) > (v_cursor_created_at, p_cursor))
      OR (v_sort = 'due'    AND v_sort_dir = 'asc'  AND (c.due,        c.id) > (v_cursor_due,        p_cursor))
      OR (v_sort = 'due'    AND v_sort_dir = 'desc' AND (c.due,        c.id) < (v_cursor_due,        p_cursor))
      OR (v_sort = 'lapses' AND v_sort_dir = 'desc' AND (c.lapses,     c.id) < (v_cursor_lapses,     p_cursor))
      OR (v_sort = 'lapses' AND v_sort_dir = 'asc'  AND (c.lapses,     c.id) > (v_cursor_lapses,     p_cursor))
    )
  ORDER BY
    -- Direction-aware ORDER BY. Only one CASE branch matches the
    -- active (sort, direction) tuple; all other branches yield NULL
    -- and don't affect ordering. The c.id tiebreaker also flips so
    -- cursor pagination remains stable across pages in either
    -- direction.
    CASE WHEN v_sort = 'recent' AND v_sort_dir = 'desc' THEN c.created_at END DESC,
    CASE WHEN v_sort = 'recent' AND v_sort_dir = 'asc'  THEN c.created_at END ASC,
    CASE WHEN v_sort = 'due'    AND v_sort_dir = 'asc'  THEN c.due        END ASC,
    CASE WHEN v_sort = 'due'    AND v_sort_dir = 'desc' THEN c.due        END DESC,
    CASE WHEN v_sort = 'lapses' AND v_sort_dir = 'desc' THEN c.lapses     END DESC,
    CASE WHEN v_sort = 'lapses' AND v_sort_dir = 'asc'  THEN c.lapses     END ASC,
    CASE WHEN v_sort_dir = 'desc' THEN c.id END DESC,
    CASE WHEN v_sort_dir = 'asc'  THEN c.id END ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Cross-deck card browser RPC. Returns one row per personal card across all
   of the caller''s decks, joined to decks.name. Supports search, deck/jlpt/
   status/missing-field/present-field/pitch-pattern filters, three sort modes
   with explicit ascending/descending direction, and tuple-based cursor
   pagination. p_sort_dir may be NULL to use the per-axis natural default
   (recent = DESC, due = ASC, lapses = DESC). p_missing_field and
   p_present_field can be set simultaneously (cross-dimension combinations
   are legitimate). Premade source cards (user_id IS NULL) are never
   returned.';
