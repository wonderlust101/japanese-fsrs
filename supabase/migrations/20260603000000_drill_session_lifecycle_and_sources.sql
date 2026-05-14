-- =============================================================
-- Migration: 20260603000000_drill_session_lifecycle_and_sources.sql
--
-- Stage 6 — the final backend stage that closes the two
-- remaining spec gaps:
--
--   §A  transition_leech_drill_session RPC (NEW)
--       — Atomic active→finished / active→aborted with idempotent
--         no-op replays and FOR-UPDATE lock against concurrent
--         transitions. Returns void; service does a follow-up
--         get_leech_drill_session for the post-state envelope so
--         the wire shape stays identical to Stage 4's GET response.
--
--   §B  CREATE OR REPLACE create_leech_drill_session (UPDATED)
--       — Adds three new parameters (p_card_ids, p_card_id,
--         p_min_lapses) and a four-branch UNION ALL candidate
--         CTE that finally wires up all five spec-defined source
--         values:
--           unresolved_leeches    (Stage 3, unchanged)
--           deck_scoped           (Stage 3, unchanged)
--           high_lapse_candidates (NEW: cards approaching leech
--                                  threshold but not yet open
--                                  leeches)
--           manual_selection      (NEW: exact card_ids from
--                                  client)
--           current_card          (NEW: single card)
--
-- The Stage 4 fingerprint helper compute_card_state_fingerprint_v1
-- is unchanged — same inputs, same byte-for-byte output, existing
-- Stage 3-5 sessions' stored hashes stay valid. The Stage 4
-- migration's DO $$ ... $$ self-test continues to guard the
-- formula on every subsequent apply.
--
-- Scheduler invariance: the transition RPC only writes
-- leech_drill_sessions.status / finished_at / updated_at. The
-- updated create RPC reads `cards` for the three new branches
-- but never writes to it. No UPDATE/DELETE/INSERT against
-- `cards` or `review_logs` is introduced anywhere.
-- =============================================================


-- ─── §A. transition_leech_drill_session RPC (NEW) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.transition_leech_drill_session(
  p_user_id       UUID,
  p_session_id    UUID,
  p_target_status TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Lock the session row + ownership check + read current status atomically.
  -- FOR UPDATE guards against concurrent transitions on the same session row
  -- (e.g. two tabs both clicking "Finish" near-simultaneously).
  SELECT status
    INTO v_current_status
    FROM public.leech_drill_sessions
    WHERE id = p_session_id
      AND user_id = p_user_id
    FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'leech_drill_session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT = 'Session does not exist or does not belong to this user.';
  END IF;

  -- Idempotent no-op: re-finishing a finished session or re-aborting an
  -- aborted one returns successfully without touching finished_at. The
  -- COALESCE below preserves the original first-finish timestamp on retries,
  -- same pattern as Stage 2's resolveLeech preserving the original
  -- resolved_at.
  IF v_current_status = p_target_status THEN
    RETURN;
  END IF;

  -- Legal transitions:
  --   active → finished   (normal completion)
  --   active → aborted    (user gave up / closed tab)
  -- Terminal states (finished, aborted) are one-way: no resurrection,
  -- no cross-terminal flips. Any non-active source state rejects.
  IF v_current_status <> 'active' THEN
    RAISE EXCEPTION 'leech_drill_session_state_conflict'
      USING ERRCODE = '22000',
            HINT = format('Cannot transition session from %s to %s.', v_current_status, p_target_status);
  END IF;

  IF p_target_status NOT IN ('finished', 'aborted') THEN
    RAISE EXCEPTION 'leech_drill_session_state_conflict'
      USING ERRCODE = '22000',
            HINT = format('Unknown target status: %s.', p_target_status);
  END IF;

  UPDATE public.leech_drill_sessions
     SET status      = p_target_status,
         finished_at = COALESCE(finished_at, NOW()),
         updated_at  = NOW()
   WHERE id = p_session_id
     AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_leech_drill_session(UUID, UUID, TEXT) TO service_role;


-- ─── §B. CREATE OR REPLACE create_leech_drill_session (UPDATED) ───────────────
--
-- Three new parameters (p_card_ids, p_card_id, p_min_lapses) and a four-branch
-- UNION ALL candidate CTE finally wire up the three new spec source values.
-- The Stage 4 fingerprint helper call is unchanged; the only `source_reason`
-- column write becomes branched instead of always-'unresolved_leech'.

CREATE OR REPLACE FUNCTION public.create_leech_drill_session(
  p_user_id       UUID,
  p_source        TEXT,
  p_deck_id       UUID,
  p_jlpt_level    TEXT,
  p_card_type     TEXT,
  p_order         TEXT,
  p_limit         INT,
  p_mode          TEXT,
  p_repeat_policy TEXT,
  p_stop_rule     JSONB,
  p_source_query  JSONB,
  p_card_ids      UUID[],   -- NEW: required when p_source='manual_selection'
  p_card_id       UUID,     -- NEW: required when p_source='current_card'
  p_min_lapses    INT       -- NEW: optional threshold for high_lapse_candidates
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id UUID;
  v_result     JSONB;
BEGIN
  INSERT INTO public.leech_drill_sessions (
    user_id, source, source_query, mode, repeat_policy, stop_rule
  ) VALUES (
    p_user_id, p_source, p_source_query, p_mode, p_repeat_policy, p_stop_rule
  )
  RETURNING id INTO v_session_id;

  -- The candidate_rows CTE unions four source-gated SELECTs. Each branch's
  -- WHERE clause includes `p_source = 'xxx'` so the planner eliminates
  -- non-matching branches at execution time — for a given call, exactly one
  -- branch runs.
  WITH candidate_rows AS (
    -- Branch A: unresolved_leeches + deck_scoped (Stage 3 path, unchanged
    -- column shape — leech_created_at and card_deck_id are projected so
    -- the post-UNION ORDER BY can reference them without sub-SELECTing
    -- back into the source tables once per row).
    SELECT
      l.id                AS leech_id,
      l.created_at        AS leech_created_at,
      c.id                AS card_id,
      c.deck_id           AS card_deck_id,
      c.layout_type::text AS layout_type,
      c.card_type::text   AS card_type,
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
    FROM public.leeches l
    JOIN public.cards   c ON c.id = l.card_id
    WHERE p_source IN ('unresolved_leeches', 'deck_scoped')
      AND l.user_id      = p_user_id
      AND l.resolved     = FALSE
      AND l.card_id IS NOT NULL
      AND c.is_suspended = FALSE
      AND (p_deck_id    IS NULL OR c.deck_id          = p_deck_id)
      AND (p_jlpt_level IS NULL OR c.jlpt_level::text = p_jlpt_level)
      AND (p_card_type  IS NULL OR c.card_type::text  = p_card_type)

    UNION ALL

    -- Branch B: high_lapse_candidates — near-leech cards that haven't crossed
    -- the leech threshold yet. leech_id / leech_created_at are NULL because
    -- no leech row exists (that's the whole point — drill before becoming
    -- a leech). The NOT EXISTS subquery excludes cards that already have an
    -- open leech.
    SELECT
      NULL::UUID,
      NULL::TIMESTAMPTZ,
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.card_type::text,
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
      AND NOT EXISTS (
        SELECT 1 FROM public.leeches existing
         WHERE existing.card_id = c.id
           AND existing.user_id = p_user_id
           AND existing.resolved = FALSE
      )
      AND (p_deck_id    IS NULL OR c.deck_id          = p_deck_id)
      AND (p_jlpt_level IS NULL OR c.jlpt_level::text = p_jlpt_level)
      AND (p_card_type  IS NULL OR c.card_type::text  = p_card_type)

    UNION ALL

    -- Branch C: manual_selection — exactly the cards the client picked. The
    -- leech_id / leech_created_at subqueries are opportunistic: if an open
    -- leech exists for the card, we carry both along; otherwise NULL. Either
    -- way the snapshot proceeds, so a manual drill works for any cards in
    -- the user's deck regardless of leech state.
    SELECT
      (SELECT existing.id
         FROM public.leeches existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1) AS leech_id,
      (SELECT existing.created_at
         FROM public.leeches existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1) AS leech_created_at,
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.card_type::text,
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

    UNION ALL

    -- Branch D: current_card — single-card pivot of manual_selection. Same
    -- opportunistic leech subqueries; same is_suspended check.
    SELECT
      (SELECT existing.id
         FROM public.leeches existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1),
      (SELECT existing.created_at
         FROM public.leeches existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1),
      c.id,
      c.deck_id,
      c.layout_type::text,
      c.card_type::text,
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
  ),
  candidates AS (
    SELECT
      leech_id,
      leech_created_at,
      card_id,
      card_deck_id,
      layout_type,
      card_type,
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
      -- Same CASE-based ORDER BY shape as Stage 3/4; the sort keys are now
      -- already-projected columns in candidate_rows so no sub-SELECT fires
      -- per row. For sources without a real leech row (high_lapse_candidates,
      -- or manual/current cards that aren't leeches), leech_created_at is
      -- NULL and NULLS LAST pushes them to the end of the time-keyed sorts —
      -- acceptable since those sorts only matter for leech-derived sources.
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
    INSERT INTO public.leech_drill_session_cards (
      session_id, card_id, leech_id, user_id, ordinal, source_reason,
      baseline_state, baseline_due, baseline_stability, baseline_difficulty,
      baseline_elapsed_days, baseline_scheduled_days, baseline_learning_steps,
      baseline_reps, baseline_lapses, baseline_last_review,
      canonical_state_fingerprint
    )
    SELECT
      v_session_id, cand.card_id, cand.leech_id, p_user_id, cand.ordinal,
      -- Branched source_reason per spec source value. All four target values
      -- are already in the leech_drill_session_cards.source_reason CHECK
      -- constraint from Stage 3 — no schema change needed.
      CASE
        WHEN p_source IN ('unresolved_leeches', 'deck_scoped') THEN 'unresolved_leech'
        WHEN p_source = 'high_lapse_candidates'                THEN 'high_lapse_candidate'
        WHEN p_source = 'manual_selection'                     THEN 'manual_selection'
        WHEN p_source = 'current_card'                         THEN 'current_card'
      END,
      cand.state, cand.due, cand.stability, cand.difficulty,
      cand.elapsed_days, cand.scheduled_days, cand.learning_steps,
      cand.reps, cand.lapses, cand.last_review,
      -- Stage 4 fingerprint helper — unchanged. Same inputs, same hash.
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
          'leechId',       i.leech_id,
          'cardId',        i.card_id,
          'ordinal',       i.ordinal,
          'layoutType',    cand.layout_type,
          'cardType',      cand.card_type,
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
$$;

GRANT EXECUTE ON FUNCTION public.create_leech_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB,
  UUID[], UUID, INT
) TO service_role;
