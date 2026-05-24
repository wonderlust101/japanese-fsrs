-- =============================================================
-- Migration: cards browser offset pagination
-- Date:     2026-06-30
--
-- Replaces the cursor-based pagination on list_cards_cross_deck
-- with offset-based pagination so the UI can support clickable
-- numbered page buttons (random page jump). The previous cursor
-- pagination only supported Prev/Next; it's not possible to derive
-- the cursor for an arbitrary page without first walking from
-- page 1.
--
-- The trade-off: offset pagination is O(N) in Postgres (scan + skip
-- the first N rows), where cursor pagination is O(1) per page. For
-- this codebase, card counts will stay in the hundreds-to-low-
-- thousands range, where offset is bounded to a handful of
-- milliseconds with the existing indexes on (created_at, id), (due,
-- id), and (lapses, id). At larger scales (10M+ rows) cursor would
-- be preferred, but that's not the target.
--
-- The function signature change is destructive — the 12-param
-- variant from 20260630000001 is dropped and replaced with a new
-- 12-param variant where `p_cursor UUID` is swapped for `p_offset
-- INT`. PostgREST is force-reloaded at the end (same precaution as
-- 20260630000002).
-- =============================================================

DROP FUNCTION IF EXISTS public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.list_cards_cross_deck(
  p_user_id        UUID,
  p_limit          INT,
  p_offset         INT     DEFAULT 0,
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
  v_sort              TEXT := COALESCE(p_sort, 'recent');
  v_sort_dir          TEXT;
  v_search_pattern    TEXT;
  v_offset            INT  := COALESCE(p_offset, 0);
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

  IF v_offset < 0 THEN
    RAISE EXCEPTION 'invalid_offset'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_offset must be >= 0.';
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
  ORDER BY
    -- Direction-aware ORDER BY (carried forward from 20260630000001).
    -- Only one CASE branch matches the active (sort, direction) tuple;
    -- all other branches yield NULL and don't affect ordering.
    CASE WHEN v_sort = 'recent' AND v_sort_dir = 'desc' THEN c.created_at END DESC,
    CASE WHEN v_sort = 'recent' AND v_sort_dir = 'asc'  THEN c.created_at END ASC,
    CASE WHEN v_sort = 'due'    AND v_sort_dir = 'asc'  THEN c.due        END ASC,
    CASE WHEN v_sort = 'due'    AND v_sort_dir = 'desc' THEN c.due        END DESC,
    CASE WHEN v_sort = 'lapses' AND v_sort_dir = 'desc' THEN c.lapses     END DESC,
    CASE WHEN v_sort = 'lapses' AND v_sort_dir = 'asc'  THEN c.lapses     END ASC,
    CASE WHEN v_sort_dir = 'desc' THEN c.id END DESC,
    CASE WHEN v_sort_dir = 'asc'  THEN c.id END ASC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, INT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, INT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Cross-deck card browser RPC. Returns one row per personal card across all
   of the caller''s decks, joined to decks.name. Supports search, deck/jlpt/
   status/missing-field/present-field/pitch-pattern filters, three sort modes
   with explicit ascending/descending direction, and OFFSET/LIMIT pagination.
   p_sort_dir may be NULL to use the per-axis natural default (recent = DESC,
   due = ASC, lapses = DESC). p_missing_field and p_present_field can be set
   simultaneously (cross-dimension combinations are legitimate). Premade
   source cards (user_id IS NULL) are never returned.';

NOTIFY pgrst, 'reload schema';
