-- =============================================================
-- Migration: 20260624000001_cards_browser_filter_relax_mutual_exclusion.sql
--
-- Follow-up to 20260624000000_cards_browser_presence_filters.sql.
--
-- The previous migration added a cross-direction guard that rejected
-- payloads with both p_missing_field and p_present_field set. The intent
-- was to prevent same-dimension contradictions (e.g. "has audio AND
-- missing audio"), but the popover's single-segmented-control-per-
-- dimension widget already makes same-dimension contradictions
-- impossible. The guard collaterally rejected legitimate cross-
-- dimension combinations like "has picture AND missing audio".
--
-- This migration drops the cross-direction guard from both RPCs.
-- Per-direction whitelist guards (token validity for p_missing_field,
-- p_present_field, p_pitch_pattern) remain in place — those are still
-- defensive. The shared Zod schema's .refine is also relaxed in the
-- companion code change.
--
-- Forward-only. CREATE OR REPLACE on both functions; signatures are
-- unchanged (same parameter list, same return shape).
-- =============================================================

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
  p_pitch_pattern  TEXT    DEFAULT NULL
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

  -- NOTE: previous migration also rejected p_missing_field AND
  -- p_present_field being simultaneously non-null. That guard is
  -- deliberately dropped here — the popover allows cross-dimension
  -- combinations ("has picture + missing audio") and same-dimension
  -- contradictions are impossible by widget design.

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
    AND (
      p_cursor IS NULL
      OR v_cursor_created_at IS NULL
      OR (v_sort = 'recent' AND (c.created_at, c.id) < (v_cursor_created_at, p_cursor))
      OR (v_sort = 'due'    AND (c.due, c.id)        > (v_cursor_due,        p_cursor))
      OR (v_sort = 'lapses' AND (c.lapses, c.id)     < (v_cursor_lapses,     p_cursor))
    )
  ORDER BY
    CASE WHEN v_sort = 'recent' THEN c.created_at END DESC,
    CASE WHEN v_sort = 'due'    THEN c.due        END ASC,
    CASE WHEN v_sort = 'lapses' THEN c.lapses     END DESC,
    c.id DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Cross-deck card browser RPC. Returns one row per personal card across all
   of the caller''s decks, joined to decks.name. Supports search, deck/jlpt/
   status/missing-field/present-field/pitch-pattern filters, three sort modes,
   and tuple-based cursor pagination. p_missing_field and p_present_field can
   be set simultaneously (cross-dimension combinations are legitimate); the
   same-dimension contradiction case is impossible by widget design on the
   client. Premade source cards (user_id IS NULL) are never returned.';


CREATE OR REPLACE FUNCTION public.count_cards_cross_deck(
  p_user_id        UUID,
  p_deck_id        UUID    DEFAULT NULL,
  p_status         TEXT    DEFAULT NULL,
  p_jlpt_level     TEXT    DEFAULT NULL,
  p_search         TEXT    DEFAULT NULL,
  p_missing_field  TEXT    DEFAULT NULL,
  p_present_field  TEXT    DEFAULT NULL,
  p_pitch_pattern  TEXT    DEFAULT NULL
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
  IF p_missing_field IS NOT NULL
     AND p_missing_field NOT IN ('reading', 'meaning', 'example', 'mnemonic', 'picture', 'nuance', 'pitch', 'audio') THEN
    RAISE EXCEPTION 'invalid_missing_field'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_present_field IS NOT NULL
     AND p_present_field NOT IN ('picture', 'pitch', 'audio') THEN
    RAISE EXCEPTION 'invalid_present_field'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_pitch_pattern IS NOT NULL
     AND p_pitch_pattern NOT IN ('heiban', 'atamadaka', 'nakadaka', 'odaka') THEN
    RAISE EXCEPTION 'invalid_pitch_pattern'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Cross-direction mutual-exclusion guard removed (was here in 20260624000000).

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
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_cards_cross_deck(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.count_cards_cross_deck(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS
  'Total matching count for the cross-deck browser. Same filter surface as
   list_cards_cross_deck minus pagination/sort, so the table footer can show
   "X cards" without paging through every row. Tracks list_cards_cross_deck
   1:1 — any predicate added there must be added here too. As of 20260624000001
   p_missing_field and p_present_field are no longer mutually exclusive.';
