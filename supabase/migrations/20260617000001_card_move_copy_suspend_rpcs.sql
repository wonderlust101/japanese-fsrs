-- =============================================================
-- Migration: 20260617000001_card_move_copy_suspend_rpcs.sql
--
-- Adds the row-level and bulk mutations the /cards browser needs:
--
--   Single-card:
--     move_card        — move a card to a different deck (sibling rows
--                        in other decks stay put)
--     copy_card        — clone the card into a target deck with fresh
--                        FSRS state; new row joins the source's sibling
--                        family (parent_card_id resolved)
--     suspend_card     — set is_suspended = TRUE
--     unsuspend_card   — set is_suspended = FALSE
--
--   Bulk (return JSONB `{succeeded, failed}`):
--     bulk_move_cards
--     bulk_suspend_cards
--     bulk_unsuspend_cards
--     bulk_delete_cards
--     bulk_tag_cards
--
-- Premade source cards (user_id IS NULL) are rejected on every path.
-- Cross-user card ids fail closed with the same shape as a missing-row
-- result so we never leak ownership signals.
--
-- The single-card RPCs bump `version` so the detail view's PATCH still
-- gates correctly under `If-Match`. The bulk variants also bump version
-- for the same reason. card_count on the source / target deck is
-- maintained manually in move_card because the cards_count_trigger only
-- fires on INSERT/DELETE.
-- =============================================================


-- ─── move_card ───────────────────────────────────────────────────────────────

CREATE FUNCTION public.move_card(
  p_card_id        UUID,
  p_user_id        UUID,
  p_target_deck_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source_deck_id UUID;
  v_user_id        UUID;
BEGIN
  -- Verify target deck is owned by the caller. RAISE before reading the
  -- card so a foreign target deck can't be probed by enumerating cards.
  IF NOT EXISTS (
    SELECT 1 FROM public.decks d
    WHERE d.id = p_target_deck_id AND d.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Target deck does not exist or does not belong to this user.';
  END IF;

  SELECT c.deck_id, c.user_id
    INTO v_source_deck_id, v_user_id
  FROM public.cards c
  WHERE c.id = p_card_id;

  IF v_user_id IS NULL THEN
    -- Either the card doesn't exist (NULL via NO_DATA_FOUND) or it's a
    -- premade source row (user_id IS NULL). Both cases fail closed.
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Card does not exist, is a premade source row, or is not owned by this user.';
  END IF;
  IF v_user_id <> p_user_id THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Card is not owned by this user.';
  END IF;

  -- No-op move: same deck. Bump version anyway so the wire response
  -- reflects an updated row.
  IF v_source_deck_id = p_target_deck_id THEN
    UPDATE public.cards
       SET version    = version + 1,
           updated_at = NOW()
     WHERE id = p_card_id;
    RETURN p_card_id;
  END IF;

  UPDATE public.cards
     SET deck_id    = p_target_deck_id,
         version    = version + 1,
         updated_at = NOW()
   WHERE id = p_card_id;

  -- Keep card_count consistent. The cards_count_trigger fires only on
  -- INSERT/DELETE, so a move needs explicit decrement+increment.
  IF v_source_deck_id IS NOT NULL THEN
    UPDATE public.decks
       SET card_count = GREATEST(card_count - 1, 0)
     WHERE id = v_source_deck_id;
  END IF;
  UPDATE public.decks
     SET card_count = card_count + 1
   WHERE id = p_target_deck_id;

  RETURN p_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_card(UUID, UUID, UUID) TO service_role;


-- ─── copy_card ───────────────────────────────────────────────────────────────

CREATE FUNCTION public.copy_card(
  p_card_id        UUID,
  p_user_id        UUID,
  p_target_deck_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source           public.cards;
  v_new_id           UUID;
  v_new_parent_id    UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.decks d
    WHERE d.id = p_target_deck_id AND d.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Target deck does not exist or does not belong to this user.';
  END IF;

  SELECT * INTO v_source
  FROM public.cards
  WHERE id = p_card_id;

  IF v_source.user_id IS NULL OR v_source.user_id <> p_user_id THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Card does not exist, is a premade source row, or is not owned by this user.';
  END IF;

  -- Sibling family resolution: if the source already has a parent, the
  -- copy joins that family. Otherwise the source becomes the family root
  -- and the copy's parent is the source's id. update_card_with_sibling_sync
  -- propagates word/reading/meaning across siblings on PATCH; this keeps
  -- the new row reachable from that traversal.
  v_new_parent_id := COALESCE(v_source.parent_card_id, v_source.id);

  INSERT INTO public.cards (
    user_id, deck_id, premade_deck_id, layout_type, fields_data,
    parent_card_id, tags, jlpt_level,
    state, is_suspended, due,
    stability, difficulty, elapsed_days, scheduled_days,
    learning_steps, reps, lapses, last_review,
    version
  ) VALUES (
    p_user_id,        -- new owner
    p_target_deck_id, -- new deck
    NULL,             -- copies are personal — never carry the premade attribution
    v_source.layout_type,
    v_source.fields_data,
    v_new_parent_id,
    v_source.tags,
    v_source.jlpt_level,
    0,                -- state = New
    FALSE,            -- not suspended
    NOW(),            -- due now
    0, 0, 0, 0,       -- FSRS clean slate
    0, 0, 0, NULL,    -- learning_steps, reps, lapses, last_review
    1                 -- version
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_card(UUID, UUID, UUID) TO service_role;


-- ─── suspend_card / unsuspend_card ───────────────────────────────────────────

CREATE FUNCTION public.suspend_card(
  p_card_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT c.user_id INTO v_user_id FROM public.cards c WHERE c.id = p_card_id;
  IF v_user_id IS NULL OR v_user_id <> p_user_id THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Card does not exist, is a premade source row, or is not owned by this user.';
  END IF;

  UPDATE public.cards
     SET is_suspended = TRUE,
         version      = version + 1,
         updated_at   = NOW()
   WHERE id = p_card_id;

  RETURN p_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_card(UUID, UUID) TO service_role;

CREATE FUNCTION public.unsuspend_card(
  p_card_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT c.user_id INTO v_user_id FROM public.cards c WHERE c.id = p_card_id;
  IF v_user_id IS NULL OR v_user_id <> p_user_id THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Card does not exist, is a premade source row, or is not owned by this user.';
  END IF;

  UPDATE public.cards
     SET is_suspended = FALSE,
         version      = version + 1,
         updated_at   = NOW()
   WHERE id = p_card_id;

  RETURN p_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsuspend_card(UUID, UUID) TO service_role;


-- ─── bulk_move_cards ─────────────────────────────────────────────────────────

CREATE FUNCTION public.bulk_move_cards(
  p_card_ids       UUID[],
  p_user_id        UUID,
  p_target_deck_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_succeeded UUID[] := '{}';
  v_failed    JSONB  := '[]'::jsonb;
  v_moves     RECORD;
BEGIN
  -- Target deck check up front — fails the whole batch if the target
  -- isn't owned. Cleaner than fanning out the same error per id.
  IF NOT EXISTS (
    SELECT 1 FROM public.decks d
    WHERE d.id = p_target_deck_id AND d.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'Target deck does not exist or does not belong to this user.';
  END IF;

  -- Partition the ids into owned (eligible) vs not. CTE keeps the
  -- partition explicit so we can emit per-id failure rows for the UI.
  FOR v_moves IN
    SELECT
      input.id     AS card_id,
      c.deck_id    AS source_deck_id,
      c.user_id    AS owner_id
    FROM UNNEST(p_card_ids) AS input(id)
    LEFT JOIN public.cards c ON c.id = input.id
  LOOP
    IF v_moves.owner_id IS NULL OR v_moves.owner_id <> p_user_id THEN
      v_failed := v_failed || jsonb_build_object(
        'id',    v_moves.card_id,
        'error', 'Card does not exist or is not owned by this user.',
        'code',  'CARD_NOT_FOUND'
      );
      CONTINUE;
    END IF;

    IF v_moves.source_deck_id = p_target_deck_id THEN
      -- No-op move; still bump version so caches invalidate.
      UPDATE public.cards
         SET version = version + 1, updated_at = NOW()
       WHERE id = v_moves.card_id;
      v_succeeded := v_succeeded || v_moves.card_id;
      CONTINUE;
    END IF;

    UPDATE public.cards
       SET deck_id    = p_target_deck_id,
           version    = version + 1,
           updated_at = NOW()
     WHERE id = v_moves.card_id;

    IF v_moves.source_deck_id IS NOT NULL THEN
      UPDATE public.decks
         SET card_count = GREATEST(card_count - 1, 0)
       WHERE id = v_moves.source_deck_id;
    END IF;
    UPDATE public.decks
       SET card_count = card_count + 1
     WHERE id = p_target_deck_id;

    v_succeeded := v_succeeded || v_moves.card_id;
  END LOOP;

  RETURN jsonb_build_object(
    'succeeded', COALESCE(to_jsonb(v_succeeded), '[]'::jsonb),
    'failed',    v_failed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_move_cards(UUID[], UUID, UUID) TO service_role;


-- ─── bulk_suspend_cards / bulk_unsuspend_cards ───────────────────────────────

CREATE FUNCTION public.bulk_suspend_cards(
  p_card_ids UUID[],
  p_user_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_succeeded UUID[] := '{}';
  v_failed    JSONB  := '[]'::jsonb;
  v_row       RECORD;
BEGIN
  FOR v_row IN
    SELECT input.id AS card_id, c.user_id AS owner_id
    FROM UNNEST(p_card_ids) AS input(id)
    LEFT JOIN public.cards c ON c.id = input.id
  LOOP
    IF v_row.owner_id IS NULL OR v_row.owner_id <> p_user_id THEN
      v_failed := v_failed || jsonb_build_object(
        'id',    v_row.card_id,
        'error', 'Card does not exist or is not owned by this user.',
        'code',  'CARD_NOT_FOUND'
      );
      CONTINUE;
    END IF;

    UPDATE public.cards
       SET is_suspended = TRUE,
           version      = version + 1,
           updated_at   = NOW()
     WHERE id = v_row.card_id;

    v_succeeded := v_succeeded || v_row.card_id;
  END LOOP;

  RETURN jsonb_build_object(
    'succeeded', COALESCE(to_jsonb(v_succeeded), '[]'::jsonb),
    'failed',    v_failed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_suspend_cards(UUID[], UUID) TO service_role;

CREATE FUNCTION public.bulk_unsuspend_cards(
  p_card_ids UUID[],
  p_user_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_succeeded UUID[] := '{}';
  v_failed    JSONB  := '[]'::jsonb;
  v_row       RECORD;
BEGIN
  FOR v_row IN
    SELECT input.id AS card_id, c.user_id AS owner_id
    FROM UNNEST(p_card_ids) AS input(id)
    LEFT JOIN public.cards c ON c.id = input.id
  LOOP
    IF v_row.owner_id IS NULL OR v_row.owner_id <> p_user_id THEN
      v_failed := v_failed || jsonb_build_object(
        'id',    v_row.card_id,
        'error', 'Card does not exist or is not owned by this user.',
        'code',  'CARD_NOT_FOUND'
      );
      CONTINUE;
    END IF;

    UPDATE public.cards
       SET is_suspended = FALSE,
           version      = version + 1,
           updated_at   = NOW()
     WHERE id = v_row.card_id;

    v_succeeded := v_succeeded || v_row.card_id;
  END LOOP;

  RETURN jsonb_build_object(
    'succeeded', COALESCE(to_jsonb(v_succeeded), '[]'::jsonb),
    'failed',    v_failed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_unsuspend_cards(UUID[], UUID) TO service_role;


-- ─── bulk_delete_cards ───────────────────────────────────────────────────────
-- Per-id deletion so the cards_count_trigger fires once per row and
-- decks.card_count drifts back to zero accurately. A single DELETE …
-- WHERE id = ANY(…) would still fire the trigger per-row, but the per-id
-- loop lets us emit a per-id failure shape for the UI.

CREATE FUNCTION public.bulk_delete_cards(
  p_card_ids UUID[],
  p_user_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_succeeded UUID[] := '{}';
  v_failed    JSONB  := '[]'::jsonb;
  v_row       RECORD;
BEGIN
  FOR v_row IN
    SELECT input.id AS card_id, c.user_id AS owner_id
    FROM UNNEST(p_card_ids) AS input(id)
    LEFT JOIN public.cards c ON c.id = input.id
  LOOP
    IF v_row.owner_id IS NULL OR v_row.owner_id <> p_user_id THEN
      v_failed := v_failed || jsonb_build_object(
        'id',    v_row.card_id,
        'error', 'Card does not exist or is not owned by this user.',
        'code',  'CARD_NOT_FOUND'
      );
      CONTINUE;
    END IF;

    DELETE FROM public.cards WHERE id = v_row.card_id;
    v_succeeded := v_succeeded || v_row.card_id;
  END LOOP;

  RETURN jsonb_build_object(
    'succeeded', COALESCE(to_jsonb(v_succeeded), '[]'::jsonb),
    'failed',    v_failed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_delete_cards(UUID[], UUID) TO service_role;


-- ─── bulk_tag_cards ──────────────────────────────────────────────────────────
-- Tag set algebra:
--   add    — append unique values not already present
--   remove — drop matching values
-- Both operations are O(tags · cards) but capped well below any
-- runaway shape (≤20 tags per card per the Zod schema, ≤500 cards per
-- bulk call). The 20-tag ceiling is re-enforced here defensively.

CREATE FUNCTION public.bulk_tag_cards(
  p_card_ids   UUID[],
  p_user_id    UUID,
  p_add_tags   TEXT[],
  p_remove_tags TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_succeeded UUID[] := '{}';
  v_failed    JSONB  := '[]'::jsonb;
  v_row       RECORD;
  v_new_tags  TEXT[];
BEGIN
  FOR v_row IN
    SELECT input.id AS card_id, c.user_id AS owner_id, c.tags AS current_tags
    FROM UNNEST(p_card_ids) AS input(id)
    LEFT JOIN public.cards c ON c.id = input.id
  LOOP
    IF v_row.owner_id IS NULL OR v_row.owner_id <> p_user_id THEN
      v_failed := v_failed || jsonb_build_object(
        'id',    v_row.card_id,
        'error', 'Card does not exist or is not owned by this user.',
        'code',  'CARD_NOT_FOUND'
      );
      CONTINUE;
    END IF;

    v_new_tags := COALESCE(v_row.current_tags, '{}');

    -- Subtraction first so add can re-introduce a tag the caller wanted
    -- to clear-and-replace in one request.
    IF p_remove_tags IS NOT NULL AND array_length(p_remove_tags, 1) > 0 THEN
      SELECT ARRAY(
        SELECT t FROM UNNEST(v_new_tags) AS t
        WHERE NOT (t = ANY(p_remove_tags))
      ) INTO v_new_tags;
    END IF;

    IF p_add_tags IS NOT NULL AND array_length(p_add_tags, 1) > 0 THEN
      SELECT ARRAY(
        SELECT DISTINCT t FROM UNNEST(v_new_tags || p_add_tags) AS t
      ) INTO v_new_tags;
    END IF;

    -- Cap at 20 — matches the Zod ceiling. We trim from the head so the
    -- newly-added tags (appended) stay; older tags may drop. Better
    -- semantics than letting the array grow unbounded.
    IF array_length(v_new_tags, 1) > 20 THEN
      v_new_tags := v_new_tags[
        array_length(v_new_tags, 1) - 19 : array_length(v_new_tags, 1)
      ];
    END IF;

    UPDATE public.cards
       SET tags       = v_new_tags,
           version    = version + 1,
           updated_at = NOW()
     WHERE id = v_row.card_id;

    v_succeeded := v_succeeded || v_row.card_id;
  END LOOP;

  RETURN jsonb_build_object(
    'succeeded', COALESCE(to_jsonb(v_succeeded), '[]'::jsonb),
    'failed',    v_failed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_tag_cards(UUID[], UUID, TEXT[], TEXT[]) TO service_role;
