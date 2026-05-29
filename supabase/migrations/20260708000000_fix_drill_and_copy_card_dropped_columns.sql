-- Migration: 20260708000000_fix_drill_and_copy_card_dropped_columns.sql
--
-- Fixes three SECURITY DEFINER functions that still reference columns dropped by
-- earlier migrations. Because all three are LANGUAGE plpgsql, Postgres deferred
-- the column resolution to first execution, so `supabase db reset` succeeded and
-- the breakage only surfaced at runtime (SQLSTATE 42703) on a database built from
-- the committed migrations:
--
--   1. create_weak_spot_drill_session — reads c.card_type (dropped in
--      20260614000000_drop_card_type.sql). Drill *start* threw
--      `column c.card_type does not exist`.
--   2. get_weak_spot_drill_session    — reads c.card_type. Drill *resume* threw
--      the same once a real session existed.
--   3. copy_card                       — inserts into the `tags` column (dropped in
--      20260630000004_drop_cards_tags_feature.sql). Card *duplication* threw
--      `column "tags" of relation "cards" does not exist`.
--
-- This migration also reconciles the two drill RPCs with the app's Zod wire
-- contract (apps/api/src/services/weak-spot-drill.service.ts), which the migration
-- history had drifted from:
--   • output key `leechId` → `weakSpotId` (DB column stays `leech_id`; only the
--     JSON key the function builds changes). The schema expects `weakSpotId`.
--   • the unused `cardType` output key is dropped (no TS consumes it).
--   • `create_weak_spot_drill_session` drops the now-meaningless `p_card_type`
--     parameter. This CHANGES the signature (14 args → 13), so it is DROP+CREATE
--     (not CREATE OR REPLACE) and the explicit service_role grant + comment are
--     re-stated. The 13 remaining parameter names match exactly what the service
--     sends, so PostgREST named-argument resolution resolves the call.
--
-- Forward-only. After applying, regenerate apps/api/src/db/database.types.ts from
-- a locally-migrated DB so the generated types match the committed migrations.

-- ─── 1. copy_card — drop the `tags` column from the INSERT ────────────────────
-- Signature unchanged → CREATE OR REPLACE preserves the existing grant.

CREATE OR REPLACE FUNCTION public.copy_card(p_card_id uuid, p_user_id uuid, p_target_deck_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
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
    parent_card_id, jlpt_level,
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
$function$;

-- ─── 2. get_weak_spot_drill_session — drop card_type; leechId → weakSpotId ─────
-- Signature unchanged → CREATE OR REPLACE preserves the existing grant.

CREATE OR REPLACE FUNCTION public.get_weak_spot_drill_session(p_user_id uuid, p_session_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_status text;
  v_result jsonb;
BEGIN
  -- 1. Ownership + existence check, captures the session status for the
  --    response envelope. Cross-user attempts return NULL → 404.
  SELECT s.status
    INTO v_status
    FROM public.weak_spot_drill_sessions s
    WHERE s.id      = p_session_id
      AND s.user_id = p_user_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'weak_spot_drill_session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The drill session does not exist or does not belong to this user.';
  END IF;

  -- 2. Recompute the fingerprint from current `cards` state, annotate each
  --    snapshot row with isStale + isOrphaned, then aggregate into the
  --    response envelope. One LEFT JOIN scan does all the work.
  WITH session_cards_with_fingerprint AS (
    SELECT
      sc.id                          AS session_card_id,
      sc.card_id,
      sc.leech_id,
      sc.ordinal,
      sc.canonical_state_fingerprint AS baseline_fp,
      c.layout_type::text            AS layout_type,
      c.fields_data,
      c.lapses,
      -- NULL when the card has been deleted (LEFT JOIN unmatched).
      CASE WHEN c.id IS NULL THEN NULL
           ELSE public.compute_card_state_fingerprint_v1(
                  c.state, c.due, c.stability, c.difficulty,
                  c.elapsed_days, c.scheduled_days, c.learning_steps,
                  c.reps, c.lapses, c.last_review
                )
      END AS current_fp
    FROM public.weak_spot_drill_session_cards sc
    LEFT JOIN public.cards c ON c.id = sc.card_id
    WHERE sc.session_id = p_session_id
  ),
  annotated AS (
    SELECT
      *,
      -- A row is "stale" only when the card still exists AND its current
      -- fingerprint differs from the stored baseline. Orphan rows (card
      -- deleted) are reported separately via cardId=null + isOrphaned=true;
      -- they are NOT counted as stale because there's nothing to compare to.
      (current_fp IS NOT NULL AND current_fp <> baseline_fp) AS is_stale
    FROM session_cards_with_fingerprint
  )
  SELECT jsonb_build_object(
    'sessionId',             p_session_id,
    'status',                v_status,
    'isCanonicalStateStale', COALESCE(bool_or(is_stale), false),
    -- jsonb_agg(...) FILTER (...) does both aggregations in one scan.
    'staleCards', COALESCE(
      jsonb_agg(card_id) FILTER (WHERE is_stale AND card_id IS NOT NULL),
      '[]'::jsonb
    ),
    'cards', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'sessionCardId', session_card_id,
          'weakSpotId',    leech_id,
          'cardId',        card_id,
          'ordinal',       ordinal,
          'layoutType',    layout_type,
          'fieldsData',    fields_data,
          'lapses',        lapses,
          'isOrphaned',    card_id IS NULL,
          'isStale',       is_stale
        ) ORDER BY ordinal
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM annotated;

  RETURN v_result;
END;
$function$;

-- ─── 3. create_weak_spot_drill_session — drop p_card_type + card_type ─────────
-- Signature CHANGES (14 args → 13: p_card_type removed), so the old function is
-- dropped and recreated. The new 13 parameter names match the service payload.

DROP FUNCTION IF EXISTS public.create_weak_spot_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB, UUID[], UUID, INT
);

CREATE FUNCTION public.create_weak_spot_drill_session(
  p_user_id       uuid,
  p_source        text,
  p_deck_id       uuid,
  p_jlpt_level    text,
  p_order         text,
  p_limit         integer,
  p_mode          text,
  p_repeat_policy text,
  p_stop_rule     jsonb,
  p_source_query  jsonb,
  p_card_ids      uuid[],
  p_card_id       uuid,
  p_min_lapses    integer
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  v_session_id UUID;
  v_result     JSONB;
BEGIN
  INSERT INTO public.weak_spot_drill_sessions (
    user_id, source, source_query, mode, repeat_policy, stop_rule
  ) VALUES (
    p_user_id, p_source, p_source_query, p_mode, p_repeat_policy, p_stop_rule
  )
  RETURNING id INTO v_session_id;

  -- Archived-deck exclusion applies to all four branches. For deck_scoped /
  -- current_card the controller already 422s on an archived target, so the
  -- filter is a defense-in-depth no-op there. For unresolved_leeches /
  -- high_lapse_candidates / manual_selection the filter silently skips
  -- cards whose deck has been frozen — a smaller-but-actionable drill
  -- beats a session that 422s on every card the moment the user starts.
  WITH archived_decks AS (
    SELECT id FROM public.decks
    WHERE user_id = p_user_id AND archived_at IS NOT NULL
  ),
  candidate_rows AS (
    -- Branch A: unresolved_leeches + deck_scoped
    SELECT
      l.id                AS leech_id,
      l.created_at        AS leech_created_at,
      c.id                AS card_id,
      c.deck_id           AS card_deck_id,
      c.layout_type::text AS layout_type,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.weak_spots l
    JOIN public.cards   c ON c.id = l.card_id
    WHERE p_source IN ('unresolved_leeches', 'deck_scoped')
      AND l.user_id      = p_user_id
      AND l.resolved     = FALSE
      AND l.card_id IS NOT NULL
      AND c.is_suspended = FALSE
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
      AND (p_deck_id    IS NULL OR c.deck_id          = p_deck_id)
      AND (p_jlpt_level IS NULL OR c.jlpt_level::text = p_jlpt_level)

    UNION ALL

    -- Branch B: high_lapse_candidates
    SELECT
      NULL::UUID,
      NULL::TIMESTAMPTZ,
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.cards c
    WHERE p_source = 'high_lapse_candidates'
      AND c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.lapses >= COALESCE(p_min_lapses, 3)
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
      AND NOT EXISTS (
        SELECT 1 FROM public.weak_spots existing
         WHERE existing.card_id = c.id
           AND existing.user_id = p_user_id
           AND existing.resolved = FALSE
      )
      AND (p_deck_id    IS NULL OR c.deck_id          = p_deck_id)
      AND (p_jlpt_level IS NULL OR c.jlpt_level::text = p_jlpt_level)

    UNION ALL

    -- Branch C: manual_selection
    SELECT
      (SELECT existing.id
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1) AS leech_id,
      (SELECT existing.created_at
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1) AS leech_created_at,
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.cards c
    WHERE p_source = 'manual_selection'
      AND c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.id = ANY(p_card_ids)
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)

    UNION ALL

    -- Branch D: current_card. Controller already gated this with
    -- assertCardDeckActive; the NOT IN here is belt-and-braces.
    SELECT
      (SELECT existing.id
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1),
      (SELECT existing.created_at
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1),
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.fields_data,
      c.state,
      c.due,
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.last_review
    FROM public.cards c
    WHERE p_source = 'current_card'
      AND c.user_id      = p_user_id
      AND c.is_suspended = FALSE
      AND c.id = p_card_id
      AND c.deck_id NOT IN (SELECT id FROM archived_decks)
  ),
  candidates AS (
    SELECT
      leech_id,
      leech_created_at,
      card_id,
      card_deck_id,
      layout_type,
      fields_data,
      state,
      due,
      stability,
      difficulty,
      elapsed_days,
      scheduled_days,
      learning_steps,
      reps,
      lapses,
      last_review,
      (row_number() OVER (
        ORDER BY
          CASE WHEN p_order = 'deckOrder'        THEN card_deck_id     END NULLS LAST,
          CASE WHEN p_order = 'oldestUnresolved' THEN leech_created_at END ASC  NULLS LAST,
          CASE WHEN p_order = 'mostLapses'       THEN lapses           END DESC NULLS LAST,
          CASE WHEN p_order IN ('mostRecent', 'deckOrder', 'mostLapses')
               THEN leech_created_at END DESC NULLS LAST,
          card_id DESC
      )) - 1 AS ordinal
    FROM candidate_rows
    LIMIT p_limit
  ),
  inserted AS (
    INSERT INTO public.weak_spot_drill_session_cards (
      session_id, card_id, leech_id, user_id, ordinal, source_reason,
      baseline_state, baseline_due, baseline_stability, baseline_difficulty,
      baseline_elapsed_days, baseline_scheduled_days, baseline_learning_steps,
      baseline_reps, baseline_lapses, baseline_last_review,
      canonical_state_fingerprint
    )
    SELECT
      v_session_id, cand.card_id, cand.leech_id, p_user_id, cand.ordinal,
      CASE
        WHEN p_source IN ('unresolved_leeches', 'deck_scoped') THEN 'unresolved_leech'
        WHEN p_source = 'high_lapse_candidates'                THEN 'high_lapse_candidate'
        WHEN p_source = 'manual_selection'                     THEN 'manual_selection'
        WHEN p_source = 'current_card'                         THEN 'current_card'
      END,
      cand.state, cand.due, cand.stability, cand.difficulty,
      cand.elapsed_days, cand.scheduled_days, cand.learning_steps,
      cand.reps, cand.lapses, cand.last_review,
      public.compute_card_state_fingerprint_v1(
        cand.state, cand.due, cand.stability, cand.difficulty,
        cand.elapsed_days, cand.scheduled_days, cand.learning_steps,
        cand.reps, cand.lapses, cand.last_review
      )
    FROM candidates cand
    ORDER BY cand.ordinal
    RETURNING id, leech_id, card_id, ordinal
  )
  SELECT jsonb_build_object(
    'sessionId', v_session_id,
    'status',    'active',
    'cards',     COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sessionCardId', i.id,
          'weakSpotId',    i.leech_id,
          'cardId',        i.card_id,
          'ordinal',       i.ordinal,
          'layoutType',    cand.layout_type,
          'fieldsData',    cand.fields_data,
          'lapses',        cand.lapses
        )
        ORDER BY i.ordinal
      )
      FROM inserted i
      JOIN candidates cand ON cand.card_id = i.card_id
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_weak_spot_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB, UUID[], UUID, INT
) TO service_role;

COMMENT ON FUNCTION public.create_weak_spot_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB, UUID[], UUID, INT
) IS
  'Builds a weak-spot drill session. Excludes cards whose deck is archived (migration 20260622000000); see also assertDeckActive / assertCardDeckActive at the controller layer for the deck_scoped / current_card hard-error paths. p_card_type was removed in 20260708000000 (the card_type column was dropped in 20260614000000).';
