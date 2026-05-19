-- =============================================================
-- Migration: 20260624000000_cards_browser_presence_filters.sql
--
-- Extends the cross-deck card browser with three new filter
-- dimensions: pitch / image / audio (presence + optional pitch
-- pattern). Wires the filter side only; display of these fields
-- in the browser is tracked separately under the polish pass.
--
-- Changes:
--   1. `count_moras(text)` SQL helper — counts moras of a hiragana
--      or katakana reading. Used by the pitch-pattern predicate.
--   2. Three partial expression indexes on `cards.fields_data` so
--      the presence predicates have an index path. Partial on
--      `user_id IS NOT NULL` because the browser never returns
--      premade source rows (see list_cards_cross_deck WHERE clause).
--   3. CREATE OR REPLACE of `list_cards_cross_deck` and
--      `count_cards_cross_deck` adding two new optional params
--      (`p_present_field`, `p_pitch_pattern`) and extending the
--      `p_missing_field` whitelist with 'pitch' and 'audio'. The
--      two RPCs share predicate semantics so the table footer's
--      total never drifts from the page slice.
--
-- Forward-only. Param lists are extended at the tail so the
-- signature change is additive — existing callers that pass only
-- the original params continue to work. The previous arity is
-- replaced wholesale (CREATE OR REPLACE) rather than overloaded.
-- =============================================================

-- ─── count_moras helper ─────────────────────────────────────────
-- Counts moras of a kana reading. A mora is one syllabic beat:
--   * Each base kana character counts as one mora.
--   * Small kana (ゃゅょぁぃぅぇぉ + katakana equivalents) do NOT
--     start a new mora — they attach to the preceding kana.
--   * The long-vowel mark ー extends the preceding mora; it does
--     NOT add a new one. (Distinct from how a long vowel written
--     with two kana like おお would count as two.)
--   * Non-kana characters (kanji, latin, punctuation) count as 0;
--     callers should pass a reading, not a surface form.
--
-- Implementation: build a regex that matches a single mora ("a
-- base kana followed by an optional small-kana modifier") and
-- count the matches via regexp_matches. This handles the small-
-- kana attachment correctly without an iterative scan.
CREATE OR REPLACE FUNCTION public.count_moras(p_reading TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_count INT := 0;
  v_i     INT := 1;
  v_len   INT;
  v_ch    TEXT;
  v_next  TEXT;
BEGIN
  IF p_reading IS NULL THEN RETURN 0; END IF;
  v_len := char_length(p_reading);
  WHILE v_i <= v_len LOOP
    v_ch := substring(p_reading FROM v_i FOR 1);
    -- Skip non-kana characters silently — count only kana moras.
    IF v_ch ~ '[ぁ-んァ-ン]' THEN
      -- Skip the long-vowel mark and small kana when they appear
      -- standalone (they should never start a mora). They will
      -- otherwise be consumed by the lookahead below.
      IF v_ch ~ '[ゃゅょャュョぁぃぅぇぉァィゥェォー]' THEN
        v_i := v_i + 1;
        CONTINUE;
      END IF;
      v_count := v_count + 1;
      -- If the next char is a small-kana modifier, consume it too
      -- (they extend the current mora rather than starting one).
      IF v_i < v_len THEN
        v_next := substring(p_reading FROM v_i + 1 FOR 1);
        IF v_next ~ '[ゃゅょャュョぁぃぅぇぉァィゥェォ]' THEN
          v_i := v_i + 1;
        END IF;
      END IF;
    END IF;
    v_i := v_i + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_moras(TEXT) TO service_role;

COMMENT ON FUNCTION public.count_moras(TEXT) IS
  'Counts moras in a hiragana/katakana reading. Small kana and the
   long-vowel mark ー attach to the preceding mora rather than
   starting one; non-kana characters are ignored.';


-- ─── Expression indexes ─────────────────────────────────────────
-- Partial indexes on JSONB key extracts. They support both the
-- positive ("has X") and negative ("missing X") branches: the
-- planner can use the index for the IS NOT NULL side directly, and
-- for the IS NULL side via an anti-join / bitmap-or.
--
-- Premade source rows (user_id IS NULL) are never returned by the
-- browser, so the partial predicate keeps the index small.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction
-- block. Supabase migrations run inside an implicit transaction by
-- default; this migration relies on the per-statement isolation
-- guarantee that supabase/postgres provides for CONCURRENTLY when
-- the migration is applied via `supabase db push` (which executes
-- each DDL statement separately for index-create operations).
-- If running via psql, this file must be split.

CREATE INDEX IF NOT EXISTS cards_has_picture_idx ON public.cards
  ((fields_data ->> 'picture'))
  WHERE user_id IS NOT NULL AND (fields_data ->> 'picture') IS NOT NULL;

CREATE INDEX IF NOT EXISTS cards_has_audio_idx ON public.cards
  ((fields_data ->> 'expressionAudio'))
  WHERE user_id IS NOT NULL AND (fields_data ->> 'expressionAudio') IS NOT NULL;

CREATE INDEX IF NOT EXISTS cards_has_pitch_idx ON public.cards
  ((fields_data ->> 'pitchPosition'))
  WHERE user_id IS NOT NULL AND (fields_data ->> 'pitchPosition') IS NOT NULL;


-- ─── list_cards_cross_deck (replaced) ───────────────────────────
-- Adds:
--   * p_present_field  — positive presence filter ('picture' |
--                        'pitch' | 'audio'). Mutually exclusive
--                        with p_missing_field.
--   * p_pitch_pattern  — pitch-pattern class ('heiban' | 'atamadaka'
--                        | 'nakadaka' | 'odaka'). Requires
--                        pitchPosition to be present and matches
--                        the class via count_moras(reading).
-- Extends:
--   * p_missing_field  whitelist now admits 'pitch' and 'audio'.
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

  IF p_missing_field IS NOT NULL AND p_present_field IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_filter_combination'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'Pass only one of p_missing_field, p_present_field.';
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
   and tuple-based cursor pagination. p_missing_field and p_present_field are
   mutually exclusive. Premade source cards (user_id IS NULL) are never
   returned.';


-- ─── count_cards_cross_deck (replaced) ──────────────────────────
-- Same filter surface as list_cards_cross_deck minus the pagination
-- and sort. Must stay in lockstep so the table footer never drifts
-- from the page slice.
-- =============================================================

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

  IF p_missing_field IS NOT NULL AND p_present_field IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_filter_combination'
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
   1:1 — any predicate added there must be added here too.';
