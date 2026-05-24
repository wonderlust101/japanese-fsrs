-- =============================================================
-- Migration: drop the cards.tags feature end-to-end
-- Date:     2026-06-30
--
-- The tags feature is being removed across all layers: the
-- `cards.tags` column goes, the bulk-tag RPC + endpoint are
-- deleted, and every RPC that previously returned the tags
-- column is recreated without it. The frontend already dropped
-- its tag UI / actions in the same PR.
--
-- Surfaces touched in this migration:
--   1. DROP FUNCTION bulk_tag_cards (the entire feature)
--   2. DROP + CREATE list_cards_cross_deck (drop tags from RETURNS + SELECT)
--   3. DROP + CREATE list_cards_paginated  (drop tags from RETURNS + SELECT)
--   4. DROP + CREATE find_similar_cards    (drop tags from RETURNS + SELECT)
--   5. DROP + CREATE get_stale_embedding_cards (drop tags from RETURNS + SELECT)
--   6. DROP + CREATE update_card_with_sibling_sync
--      (drop p_tags param, drop tags from RETURNS + SET + final RETURN)
--   7. DROP + CREATE copy_premade_deck (drop tags from INSERT)
--   8. DROP + CREATE copy_user_deck    (drop tags from INSERT)
--   9. ALTER TABLE cards DROP COLUMN tags
--  10. NOTIFY pgrst, 'reload schema'
--
-- Order matters: every RPC that references c.tags must be
-- recreated before the column drop, otherwise the dropped
-- column would leave functions in a broken state until they
-- next get redefined. We DROP the old function signatures and
-- CREATE the new ones in the same transaction, then ALTER
-- TABLE DROP COLUMN, then NOTIFY.
-- =============================================================

-- ── 1. bulk_tag_cards: drop entirely ────────────────────────
DROP FUNCTION IF EXISTS public.bulk_tag_cards(
  UUID[], UUID, TEXT[], TEXT[]
);

-- ── 2. list_cards_cross_deck ────────────────────────────────
DROP FUNCTION IF EXISTS public.list_cards_cross_deck(
  UUID, INT, INT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
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
      OR (p_missing_field = 'audio'    AND (c.fields_data ->> 'expressionAudio' IS NULL OR c.fields_data ->> 'expressionAudio' = ''))
    )
    AND (p_present_field IS NULL OR c.layout_type IN ('vocabulary', 'grammar'))
    AND (
      p_present_field IS NULL
      OR (p_present_field = 'picture' AND (c.fields_data ->> 'picture')        IS NOT NULL AND (c.fields_data ->> 'picture')        <> '')
      OR (p_present_field = 'pitch'   AND (c.fields_data ->> 'pitchPosition')  IS NOT NULL AND (c.fields_data ->> 'pitchPosition')  <> '')
      OR (p_present_field = 'audio'   AND (c.fields_data ->> 'expressionAudio') IS NOT NULL AND (c.fields_data ->> 'expressionAudio') <> '')
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

-- ── 3. list_cards_paginated ─────────────────────────────────
DROP FUNCTION IF EXISTS public.list_cards_paginated(
  UUID, UUID, INT, UUID, TEXT
);

CREATE OR REPLACE FUNCTION public.list_cards_paginated(
  p_user_id        UUID,
  p_deck_id        UUID,
  p_limit          INT,
  p_cursor         UUID    DEFAULT NULL,
  p_status_filter  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  fields_data  JSONB,
  layout_type  public.layout_type,
  jlpt_level   public.jlpt_level,
  state        INT,
  is_suspended BOOLEAN,
  due          TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cursor_at TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.decks d
    WHERE d.id = p_deck_id AND d.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified deck does not exist or does not belong to this user.';
  END IF;

  IF p_cursor IS NOT NULL THEN
    SELECT c.created_at INTO v_cursor_at
    FROM public.cards c
    WHERE c.id = p_cursor AND c.user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.fields_data, c.layout_type, c.jlpt_level,
    c.state, c.is_suspended, c.due
  FROM public.cards c
  WHERE c.user_id = p_user_id
    AND c.deck_id = p_deck_id
    AND (
      p_status_filter IS NULL OR p_status_filter = 'all'
      OR (p_status_filter = 'new'       AND c.state = 0       AND c.is_suspended = FALSE)
      OR (p_status_filter = 'learning'  AND c.state IN (1, 3) AND c.is_suspended = FALSE)
      OR (p_status_filter = 'review'    AND c.state = 2       AND c.is_suspended = FALSE)
      OR (p_status_filter = 'suspended' AND c.is_suspended = TRUE)
    )
    AND (
      v_cursor_at IS NULL
      OR (c.created_at, c.id) < (v_cursor_at, p_cursor)
    )
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_cards_paginated(
  UUID, UUID, INT, UUID, TEXT
) TO service_role;

-- ── 4. find_similar_cards ───────────────────────────────────
DROP FUNCTION IF EXISTS public.find_similar_cards(
  UUID, UUID, INT
);

CREATE OR REPLACE FUNCTION public.find_similar_cards(
  p_card_id UUID,
  p_user_id UUID,
  p_limit   INT DEFAULT 10
)
RETURNS TABLE (
  id          UUID,
  deck_id     UUID,
  layout_type public.layout_type,
  fields_data JSONB,
  jlpt_level  public.jlpt_level,
  similarity  DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.deck_id,
    c.layout_type,
    c.fields_data,
    c.jlpt_level,
    1 - (c.embedding <=> src.embedding) AS similarity
  FROM public.cards c
  JOIN public.cards src ON src.id = p_card_id
  WHERE c.user_id     = p_user_id
    AND c.id         != p_card_id
    AND c.embedding   IS NOT NULL
    AND src.embedding IS NOT NULL
  ORDER BY c.embedding <=> src.embedding
  LIMIT p_limit;
$$;

-- ── 5. get_stale_embedding_cards ────────────────────────────
DROP FUNCTION IF EXISTS public.get_stale_embedding_cards(UUID);

CREATE OR REPLACE FUNCTION public.get_stale_embedding_cards(
  p_user_id UUID
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  deck_id         UUID,
  layout_type     public.layout_type,
  fields_data     JSONB,
  parent_card_id  UUID,
  jlpt_level      public.jlpt_level,
  state           INT,
  is_suspended    BOOLEAN,
  due             TIMESTAMPTZ,
  stability       DOUBLE PRECISION,
  difficulty      DOUBLE PRECISION,
  elapsed_days    INT,
  scheduled_days  INT,
  reps            INT,
  lapses          INT,
  last_review     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id, c.user_id, c.deck_id, c.layout_type, c.fields_data,
    c.parent_card_id, c.jlpt_level,
    c.state, c.is_suspended, c.due, c.stability, c.difficulty,
    c.elapsed_days, c.scheduled_days, c.reps, c.lapses,
    c.last_review, c.created_at, c.updated_at
  FROM public.cards c
  WHERE c.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND c.embedding_updated_at IS NOT NULL
    AND c.embedding_updated_at < c.updated_at;
$$;

-- ── 6. update_card_with_sibling_sync (drop p_tags, drop tags col) ─
DROP FUNCTION IF EXISTS public.update_card_with_sibling_sync(
  UUID, UUID, INT, JSONB, public.layout_type, TEXT[], public.jlpt_level
);

CREATE OR REPLACE FUNCTION public.update_card_with_sibling_sync(
  p_card_id          UUID,
  p_user_id          UUID,
  p_expected_version INT,
  p_fields_data      JSONB              DEFAULT NULL,
  p_layout_type      public.layout_type DEFAULT NULL,
  p_jlpt_level       public.jlpt_level  DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  deck_id         UUID,
  premade_deck_id UUID,
  layout_type     public.layout_type,
  fields_data     JSONB,
  parent_card_id  UUID,
  jlpt_level      public.jlpt_level,
  state           INT,
  is_suspended    BOOLEAN,
  due             TIMESTAMPTZ,
  stability       DOUBLE PRECISION,
  difficulty      DOUBLE PRECISION,
  elapsed_days    INT,
  scheduled_days  INT,
  learning_steps  INT,
  reps            INT,
  lapses          INT,
  last_review     TIMESTAMPTZ,
  version         INT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_root_id         UUID;
  v_current_version INT;
  v_shared_fields   JSONB := '{}'::jsonb;
BEGIN
  SELECT c.version
    INTO v_current_version
    FROM public.cards c
   WHERE c.id = p_card_id
     AND c.user_id = p_user_id
     FOR UPDATE;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified card does not exist or does not belong to this user.';
  END IF;

  IF v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'card_version_mismatch'
      USING ERRCODE = '22000',
            HINT    = 'Card was modified since the version snapshot. Refetch and retry.';
  END IF;

  UPDATE public.cards SET
    fields_data = COALESCE(p_fields_data, fields_data),
    layout_type = COALESCE(p_layout_type, layout_type),
    jlpt_level  = COALESCE(p_jlpt_level,  jlpt_level),
    version     = version + 1,
    updated_at  = NOW()
  WHERE public.cards.id = p_card_id
    AND public.cards.user_id = p_user_id;

  IF p_fields_data IS NOT NULL THEN
    SELECT COALESCE(c.parent_card_id, c.id)
      INTO v_root_id
      FROM public.cards c
     WHERE c.id = p_card_id;

    IF p_fields_data ? 'word' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('word', p_fields_data->'word');
    END IF;
    IF p_fields_data ? 'reading' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('reading', p_fields_data->'reading');
    END IF;
    IF p_fields_data ? 'meaning' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('meaning', p_fields_data->'meaning');
    END IF;

    IF v_shared_fields <> '{}'::jsonb THEN
      UPDATE public.cards
         SET fields_data = fields_data || v_shared_fields,
             version     = version + 1,
             updated_at  = NOW()
       WHERE public.cards.user_id = p_user_id
         AND public.cards.id != p_card_id
         AND (public.cards.parent_card_id = v_root_id OR public.cards.id = v_root_id);
    END IF;
  END IF;

  RETURN QUERY
    SELECT c.id, c.user_id, c.deck_id, c.premade_deck_id, c.layout_type,
           c.fields_data, c.parent_card_id, c.jlpt_level,
           c.state, c.is_suspended, c.due, c.stability, c.difficulty,
           c.elapsed_days, c.scheduled_days, c.learning_steps, c.reps, c.lapses,
           c.last_review, c.version, c.created_at, c.updated_at
      FROM public.cards c
     WHERE c.id = p_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_card_with_sibling_sync(
  UUID, UUID, INT, JSONB, public.layout_type, public.jlpt_level
) TO service_role;

-- ── 7. copy_premade_deck (drop tags from INSERT) ────────────
CREATE OR REPLACE FUNCTION public.copy_premade_deck(
  p_user_id         UUID,
  p_premade_deck_id UUID
)
RETURNS TABLE (
  deck_id    UUID,
  card_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_premade        RECORD;
  v_new_deck_id    UUID;
  v_inserted_count INT;
BEGIN
  SELECT id, name, description, deck_type, is_active
    INTO v_premade
    FROM public.premade_decks
   WHERE id = p_premade_deck_id
     AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'premade_deck_not_found'
      USING ERRCODE = '02000',
            HINT    = 'The premade deck does not exist or is inactive.';
  END IF;

  INSERT INTO public.decks (
    user_id, name, description, deck_type, source_premade_id
  )
  VALUES (
    p_user_id, v_premade.name, v_premade.description, v_premade.deck_type, p_premade_deck_id
  )
  RETURNING id INTO v_new_deck_id;

  WITH cloned AS (
    INSERT INTO public.cards (
      user_id, deck_id, premade_deck_id,
      layout_type, fields_data, jlpt_level,
      due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps,
      reps, lapses, state, last_review,
      embedding, embedding_updated_at
    )
    SELECT
      p_user_id, v_new_deck_id, NULL,
      c.layout_type, c.fields_data, c.jlpt_level,
      NOW(), 0, 0,
      0, 0, 0,
      0, 0, 0, NULL,
      c.embedding, c.embedding_updated_at
    FROM public.cards c
    WHERE c.premade_deck_id = p_premade_deck_id
      AND c.user_id IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted_count FROM cloned;

  RETURN QUERY SELECT v_new_deck_id, v_inserted_count;
END;
$$;

-- ── 8. copy_user_deck (drop tags from INSERT) ───────────────
CREATE OR REPLACE FUNCTION public.copy_user_deck(
  p_user_id        UUID,
  p_source_deck_id UUID,
  p_target_name    TEXT
)
RETURNS TABLE (
  deck_id    UUID,
  card_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source         RECORD;
  v_new_deck_id    UUID;
  v_inserted_count INT;
  v_resolved_name  TEXT;
  v_candidate      TEXT;
  v_suffix         INT;
BEGIN
  SELECT id, user_id, name, description, deck_type
    INTO v_source
    FROM public.decks
   WHERE id = p_source_deck_id;

  IF v_source.id IS NULL OR v_source.user_id IS NULL OR v_source.user_id <> p_user_id THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = '02000',
            HINT    = 'Source deck does not exist or does not belong to this user.';
  END IF;

  IF p_target_name IS NOT NULL AND length(trim(p_target_name)) > 0 THEN
    v_resolved_name := trim(p_target_name);
  ELSE
    v_candidate := v_source.name || ' (Copy)';
    v_suffix    := 2;
    WHILE EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.user_id = p_user_id AND d.name = v_candidate
    ) LOOP
      v_candidate := v_source.name || ' (Copy ' || v_suffix || ')';
      v_suffix    := v_suffix + 1;
      IF v_suffix > 1000 THEN
        RAISE EXCEPTION 'copy_name_collision_overflow'
          USING ERRCODE = '54000',
                HINT    = 'Could not resolve a unique copy name after 1000 attempts.';
      END IF;
    END LOOP;
    v_resolved_name := v_candidate;
  END IF;

  INSERT INTO public.decks (
    user_id, name, description, deck_type, source_premade_id
  )
  VALUES (
    p_user_id, v_resolved_name, v_source.description, v_source.deck_type, NULL
  )
  RETURNING id INTO v_new_deck_id;

  WITH cloned AS (
    INSERT INTO public.cards (
      user_id, deck_id, premade_deck_id,
      layout_type, fields_data, jlpt_level,
      due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps,
      reps, lapses, state, last_review,
      embedding, embedding_updated_at
    )
    SELECT
      p_user_id, v_new_deck_id, NULL,
      c.layout_type, c.fields_data, c.jlpt_level,
      NOW(), 0, 0,
      0, 0, 0,
      0, 0, 0, NULL,
      c.embedding, c.embedding_updated_at
    FROM public.cards c
    WHERE c.deck_id = p_source_deck_id
      AND c.user_id = p_user_id
      AND c.is_suspended = FALSE
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted_count FROM cloned;

  RETURN QUERY SELECT v_new_deck_id, v_inserted_count;
END;
$$;

-- ── 9. drop the cards.tags column ───────────────────────────
-- All RPCs that previously referenced this column have been
-- recreated above without it; safe to drop now.
ALTER TABLE public.cards DROP COLUMN IF EXISTS tags;

-- ── 10. reload PostgREST so the new signatures are picked up ─
NOTIFY pgrst, 'reload schema';
