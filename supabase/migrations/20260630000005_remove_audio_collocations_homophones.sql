-- =============================================================
-- Migration: remove audio + collocations + homophones from cards
-- Date:     2026-06-30
--
-- The card model drops three audio fields (WordFields.expressionAudio,
-- ExampleSentence.sentenceAudio, SentenceFieldsData.audio) plus the two
-- related-words fields (VocabularyFieldsData.collocations / homophones).
-- The shared-types schemas, AI prompts, review display, /add/review
-- editor, and cards-browser audio filter were updated in the same PR.
--
-- This migration handles the database side:
--   1. Scrub the removed top-level keys from fields_data on existing rows.
--   2. Scrub the nested `sentenceAudio` key from exampleSentences entries.
--   3. Drop the now-dead `cards_has_audio_idx` (indexed expressionAudio).
--   4. Recreate list_cards_cross_deck WITHOUT the 'audio' filter branch.
--   5. Recreate count_cards_cross_deck WITHOUT the 'audio' filter branch.
--   6. NOTIFY pgrst, 'reload schema'.
--
-- Notes:
--   - The fields_data CHECK constraint (`cards_fields_data_shape`) enforces
--     required keys only, so removing these optional keys never violates it.
--   - `updated_at` is intentionally left untouched so the scrub does not
--     mark every card embedding-stale (get_stale_embedding_cards compares
--     embedding_updated_at < updated_at).
--   - The two RPCs keep their existing signatures, so CREATE OR REPLACE is
--     sufficient (no DROP needed). The 'audio' value is removed from the
--     parameter-validation IN-lists and from the missing/present branches;
--     the matching wire enums (cardMissingFieldEnum / cardPresentFieldEnum)
--     dropped 'audio' in the same PR, so the RPC can never receive it.
-- =============================================================

-- ── 1. Scrub removed top-level keys ─────────────────────────
-- collocations / homophones / expressionAudio live on vocabulary cards;
-- `audio` is the sentence-layout top-level key. Applying the subtraction
-- globally is safe — `-` on an absent key is a no-op.
UPDATE public.cards
SET fields_data = fields_data
      - 'collocations'
      - 'homophones'
      - 'expressionAudio'
      - 'audio'
WHERE fields_data ?| array['collocations', 'homophones', 'expressionAudio', 'audio'];

-- ── 2. Scrub nested sentenceAudio from exampleSentences ─────
-- sentenceAudio sits inside each element of the exampleSentences array, so
-- a top-level `-` cannot reach it. Rebuild the array with the key stripped
-- from every element.
UPDATE public.cards
SET fields_data = jsonb_set(
      fields_data,
      '{exampleSentences}',
      (
        SELECT jsonb_agg(elem - 'sentenceAudio')
        FROM jsonb_array_elements(fields_data -> 'exampleSentences') AS elem
      )
    )
WHERE jsonb_typeof(fields_data -> 'exampleSentences') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(fields_data -> 'exampleSentences') AS elem
    WHERE elem ? 'sentenceAudio'
  );

-- ── 3. Drop the dead expressionAudio index ─────────────────
-- cards_has_audio_idx (migration 20260624000000) indexed
-- fields_data ->> 'expressionAudio' to support the now-removed audio
-- filter arm. With the field scrubbed and the filter gone, it only adds
-- write overhead.
DROP INDEX IF EXISTS public.cards_has_audio_idx;

-- ── 4. list_cards_cross_deck without the 'audio' filter ─────
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
            HINT    = 'p_sort_dir must be one of: asc, desc.';
  END IF;

  IF v_offset < 0 THEN
    RAISE EXCEPTION 'invalid_offset'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'p_offset must be >= 0.';
  END IF;

  v_sort_dir := COALESCE(p_sort_dir,
    CASE v_sort
      WHEN 'recent' THEN 'desc'
      WHEN 'due'    THEN 'asc'
      WHEN 'lapses' THEN 'desc'
    END
  );

  IF p_missing_field IS NOT NULL
     AND p_missing_field NOT IN ('reading', 'meaning', 'example', 'mnemonic', 'picture', 'nuance', 'pitch') THEN
    RAISE EXCEPTION 'invalid_missing_field'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_present_field IS NOT NULL
     AND p_present_field NOT IN ('picture', 'pitch') THEN
    RAISE EXCEPTION 'invalid_present_field'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_pitch_pattern IS NOT NULL
     AND p_pitch_pattern NOT IN ('heiban', 'atamadaka', 'nakadaka', 'odaka') THEN
    RAISE EXCEPTION 'invalid_pitch_pattern'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_search IS NOT NULL AND length(p_search) > 0 THEN
    v_search_pattern := '%' || lower(p_search) || '%';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.deck_id, d.name AS deck_name, c.fields_data, c.layout_type,
    c.jlpt_level, c.state, c.is_suspended, c.due, c.lapses, c.created_at
  FROM public.cards c
  JOIN public.decks d ON d.id = c.deck_id
  WHERE c.user_id = p_user_id
    AND (p_deck_id IS NULL OR c.deck_id = p_deck_id)
    AND (
      p_status IS NULL OR p_status = 'all'
      OR (p_status = 'new'       AND c.state = 0       AND c.is_suspended = FALSE)
      OR (p_status = 'learning'  AND c.state IN (1, 3) AND c.is_suspended = FALSE)
      OR (p_status = 'review'    AND c.state = 2       AND c.is_suspended = FALSE)
      OR (p_status = 'suspended' AND c.is_suspended = TRUE)
    )
    AND (
      p_jlpt_level IS NULL OR p_jlpt_level = 'all'
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
      p_missing_field IS NULL OR c.layout_type IN ('vocabulary', 'grammar')
    )
    AND (
      p_missing_field IS NULL
      OR (p_missing_field = 'reading'  AND (c.fields_data ->> 'reading'  IS NULL OR c.fields_data ->> 'reading'  = ''))
      OR (p_missing_field = 'meaning'  AND (c.fields_data ->> 'meaning'  IS NULL OR c.fields_data ->> 'meaning'  = ''))
      OR (p_missing_field = 'example'  AND (NOT (c.fields_data ? 'exampleSentences')
                                          OR jsonb_typeof(c.fields_data -> 'exampleSentences') <> 'array'
                                          OR jsonb_array_length(c.fields_data -> 'exampleSentences') = 0))
      OR (p_missing_field = 'mnemonic' AND (c.fields_data ->> 'mnemonic' IS NULL OR c.fields_data ->> 'mnemonic' = ''))
      OR (p_missing_field = 'picture'  AND (c.fields_data ->> 'picture'  IS NULL OR c.fields_data ->> 'picture'  = ''))
      OR (p_missing_field = 'nuance'   AND (c.fields_data ->> 'nuance'   IS NULL OR c.fields_data ->> 'nuance'   = ''))
      OR (p_missing_field = 'pitch'    AND (c.fields_data ->> 'pitchPosition' IS NULL OR c.fields_data ->> 'pitchPosition' = '')
                                        AND (c.fields_data ->> 'pitchAccent'   IS NULL OR c.fields_data ->> 'pitchAccent'   = ''))
    )
    AND (p_present_field IS NULL OR c.layout_type IN ('vocabulary', 'grammar'))
    AND (
      p_present_field IS NULL
      OR (p_present_field = 'picture' AND (c.fields_data ->> 'picture')        IS NOT NULL AND (c.fields_data ->> 'picture')        <> '')
      OR (p_present_field = 'pitch'   AND (c.fields_data ->> 'pitchPosition')  IS NOT NULL AND (c.fields_data ->> 'pitchPosition')  <> '')
    )
    AND (
      p_pitch_pattern IS NULL
      OR (
        (c.fields_data ->> 'pitchPosition') IS NOT NULL
        AND (c.fields_data ->> 'pitchPosition') ~ '^[0-9]+$'
        AND (
          (p_pitch_pattern = 'heiban'    AND (c.fields_data ->> 'pitchPosition')::INT = 0)
          OR (p_pitch_pattern = 'atamadaka' AND (c.fields_data ->> 'pitchPosition')::INT = 1)
          OR (p_pitch_pattern = 'nakadaka'  AND (c.fields_data ->> 'pitchPosition')::INT > 1
                                            AND (c.fields_data ->> 'pitchPosition')::INT < public.count_moras(c.fields_data ->> 'reading'))
          OR (p_pitch_pattern = 'odaka'     AND (c.fields_data ->> 'pitchPosition')::INT > 1
                                            AND (c.fields_data ->> 'pitchPosition')::INT = public.count_moras(c.fields_data ->> 'reading'))
        )
      )
    )
  ORDER BY
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

-- ── 5. count_cards_cross_deck without the 'audio' filter ────
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
     AND p_missing_field NOT IN ('reading', 'meaning', 'example', 'mnemonic', 'picture', 'nuance', 'pitch') THEN
    RAISE EXCEPTION 'invalid_missing_field'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_present_field IS NOT NULL
     AND p_present_field NOT IN ('picture', 'pitch') THEN
    RAISE EXCEPTION 'invalid_present_field'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_pitch_pattern IS NOT NULL
     AND p_pitch_pattern NOT IN ('heiban', 'atamadaka', 'nakadaka', 'odaka') THEN
    RAISE EXCEPTION 'invalid_pitch_pattern'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

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

-- ── 6. reload PostgREST so the new signatures are picked up ─
NOTIFY pgrst, 'reload schema';
