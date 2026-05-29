-- Physical leech → weak_spot rename (audit M1, Tier-2).
--
-- The 20260615 migration renamed the *tables* (leeches → weak_spots,
-- leech_drill_* → weak_spot_drill_*) but left the leech_id column, the
-- p_leech_threshold / p_asserted_leech_id RPC params, the unresolved_leeches /
-- unresolved_leech source values, and the leech_* constraint names. This
-- migration finishes the physical convergence so no "leech" identifier remains.
--
-- Forward-only. Function bodies are the exact pg_get_functiondef output of the
-- live (migrations-truth) definitions with a mechanical leech→weak_spot
-- substitution — no behavioral change beyond the rename. Data UPDATEs run
-- before the CHECK swap so existing rows conform on a remote apply too.
--
-- Wire impact: the drill `source` enum value unresolvedLeeches → unresolvedWeakSpots
-- changes in lockstep with the app (weak-spots.actions.ts, weak-spot.schema.ts,
-- weak-spot-drill.service.ts). Pre-launch clean break.

-- ── 1. Columns ────────────────────────────────────────────────────────────────
ALTER TABLE public.weak_spot_drill_attempts      RENAME COLUMN leech_id TO weak_spot_id;
ALTER TABLE public.weak_spot_drill_session_cards RENAME COLUMN leech_id TO weak_spot_id;

-- ── 2. Constraint names (cosmetic; not referenced by app code) ──────────────────
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_answered_after_shown TO weak_spot_drill_attempts_answered_after_shown;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_card_id_fkey TO weak_spot_drill_attempts_card_id_fkey;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_leech_id_fkey TO weak_spot_drill_attempts_weak_spot_id_fkey;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_local_sequence_valid TO weak_spot_drill_attempts_local_sequence_valid;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_pkey TO weak_spot_drill_attempts_pkey;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_response_time_valid TO weak_spot_drill_attempts_response_time_valid;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_result_check TO weak_spot_drill_attempts_result_check;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_session_card_fk TO weak_spot_drill_attempts_session_card_fk;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_session_fk TO weak_spot_drill_attempts_session_fk;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_user_id_event_id_key TO weak_spot_drill_attempts_user_id_event_id_key;
ALTER TABLE weak_spot_drill_attempts RENAME CONSTRAINT leech_drill_attempts_user_id_fkey TO weak_spot_drill_attempts_user_id_fkey;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_difficulty_check TO weak_spot_drill_session_cards_baseline_difficulty_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_elapsed_days_check TO weak_spot_drill_session_cards_baseline_elapsed_days_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_lapses_check TO weak_spot_drill_session_cards_baseline_lapses_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_learning_steps_check TO weak_spot_drill_session_cards_baseline_learning_steps_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_reps_check TO weak_spot_drill_session_cards_baseline_reps_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_scheduled_days_check TO weak_spot_drill_session_cards_baseline_scheduled_days_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_stability_check TO weak_spot_drill_session_cards_baseline_stability_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_baseline_state_check TO weak_spot_drill_session_cards_baseline_state_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_card_id_fkey TO weak_spot_drill_session_cards_card_id_fkey;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_id_session_id_key TO weak_spot_drill_session_cards_id_session_id_key;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_leech_id_fkey TO weak_spot_drill_session_cards_weak_spot_id_fkey;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_ordinal_check TO weak_spot_drill_session_cards_ordinal_check;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_pkey TO weak_spot_drill_session_cards_pkey;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_session_id_fkey TO weak_spot_drill_session_cards_session_id_fkey;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_session_id_ordinal_key TO weak_spot_drill_session_cards_session_id_ordinal_key;
ALTER TABLE weak_spot_drill_session_cards RENAME CONSTRAINT leech_drill_session_cards_user_id_fkey TO weak_spot_drill_session_cards_user_id_fkey;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_finished_at_valid TO weak_spot_drill_sessions_finished_at_valid;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_mode_check TO weak_spot_drill_sessions_mode_check;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_pkey TO weak_spot_drill_sessions_pkey;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_repeat_policy_check TO weak_spot_drill_sessions_repeat_policy_check;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_source_query_object TO weak_spot_drill_sessions_source_query_object;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_status_check TO weak_spot_drill_sessions_status_check;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_stop_rule_object TO weak_spot_drill_sessions_stop_rule_object;
ALTER TABLE weak_spot_drill_sessions RENAME CONSTRAINT leech_drill_sessions_user_id_fkey TO weak_spot_drill_sessions_user_id_fkey;
ALTER TABLE weak_spots RENAME CONSTRAINT leeches_card_id_fkey TO weak_spots_card_id_fkey;
ALTER TABLE weak_spots RENAME CONSTRAINT leeches_pkey TO weak_spots_pkey;
ALTER TABLE weak_spots RENAME CONSTRAINT leeches_user_id_fkey TO weak_spots_user_id_fkey;

-- Standalone indexes (CREATE INDEX, not constraint-backed — missed by the renames above).
ALTER INDEX public.leech_drill_attempts_session_card_idx RENAME TO weak_spot_drill_attempts_session_card_idx;
ALTER INDEX public.leech_drill_attempts_session_idx      RENAME TO weak_spot_drill_attempts_session_idx;

-- ── 3. Source enum values (data first, then swap the CHECK so a remote apply
--        with existing rows stays valid) ──────────────────────────────────────
UPDATE public.weak_spot_drill_sessions      SET source = 'unresolved_weak_spots' WHERE source = 'unresolved_leeches';
UPDATE public.weak_spot_drill_session_cards SET source_reason = 'unresolved_weak_spot' WHERE source_reason = 'unresolved_leech';

ALTER TABLE public.weak_spot_drill_sessions      DROP CONSTRAINT leech_drill_sessions_source_check;
ALTER TABLE public.weak_spot_drill_sessions      ADD  CONSTRAINT weak_spot_drill_sessions_source_check CHECK (source = ANY (ARRAY['unresolved_weak_spots'::text, 'high_lapse_candidates'::text, 'deck_scoped'::text, 'manual_selection'::text, 'current_card'::text]));
ALTER TABLE public.weak_spot_drill_session_cards DROP CONSTRAINT leech_drill_session_cards_source_reason_check;
ALTER TABLE public.weak_spot_drill_session_cards ADD  CONSTRAINT weak_spot_drill_session_cards_source_reason_check CHECK (source_reason = ANY (ARRAY['unresolved_weak_spot'::text, 'high_lapse_candidate'::text, 'manual_selection'::text, 'current_card'::text]));

-- ── 4. Drop the 3 functions whose signature changes (param rename) ──────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace
             AND proname IN ('process_review','process_review_batch','record_weak_spot_drill_attempt')
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

-- ── 5. Recreate all 7 leech-referencing functions (transformed bodies) ──────────
CREATE OR REPLACE FUNCTION public.create_weak_spot_drill_session(p_user_id uuid, p_source text, p_deck_id uuid, p_jlpt_level text, p_order text, p_limit integer, p_mode text, p_repeat_policy text, p_stop_rule jsonb, p_source_query jsonb, p_card_ids uuid[], p_card_id uuid, p_min_lapses integer)
 RETURNS jsonb
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
  -- filter is a defense-in-depth no-op there. For unresolved_weak_spots /
  -- high_lapse_candidates / manual_selection the filter silently skips
  -- cards whose deck has been frozen — a smaller-but-actionable drill
  -- beats a session that 422s on every card the moment the user starts.
  WITH archived_decks AS (
    SELECT id FROM public.decks
    WHERE user_id = p_user_id AND archived_at IS NOT NULL
  ),
  candidate_rows AS (
    -- Branch A: unresolved_weak_spots + deck_scoped
    SELECT
      l.id                AS weak_spot_id,
      l.created_at        AS weak_spot_created_at,
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
    WHERE p_source IN ('unresolved_weak_spots', 'deck_scoped')
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
        LIMIT 1) AS weak_spot_id,
      (SELECT existing.created_at
         FROM public.weak_spots existing
        WHERE existing.card_id = c.id
          AND existing.user_id = p_user_id
          AND existing.resolved = FALSE
        LIMIT 1) AS weak_spot_created_at,
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
      weak_spot_id,
      weak_spot_created_at,
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
          CASE WHEN p_order = 'oldestUnresolved' THEN weak_spot_created_at END ASC  NULLS LAST,
          CASE WHEN p_order = 'mostLapses'       THEN lapses           END DESC NULLS LAST,
          CASE WHEN p_order IN ('mostRecent', 'deckOrder', 'mostLapses')
               THEN weak_spot_created_at END DESC NULLS LAST,
          card_id DESC
      )) - 1 AS ordinal
    FROM candidate_rows
    LIMIT p_limit
  ),
  inserted AS (
    INSERT INTO public.weak_spot_drill_session_cards (
      session_id, card_id, weak_spot_id, user_id, ordinal, source_reason,
      baseline_state, baseline_due, baseline_stability, baseline_difficulty,
      baseline_elapsed_days, baseline_scheduled_days, baseline_learning_steps,
      baseline_reps, baseline_lapses, baseline_last_review,
      canonical_state_fingerprint
    )
    SELECT
      v_session_id, cand.card_id, cand.weak_spot_id, p_user_id, cand.ordinal,
      CASE
        WHEN p_source IN ('unresolved_weak_spots', 'deck_scoped') THEN 'unresolved_weak_spot'
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
    RETURNING id, weak_spot_id, card_id, ordinal
  )
  SELECT jsonb_build_object(
    'sessionId', v_session_id,
    'status',    'active',
    'cards',     COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sessionCardId', i.id,
          'weakSpotId',    i.weak_spot_id,
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
$function$

;

CREATE OR REPLACE FUNCTION public.get_session_summary(p_session_id uuid, p_user_id uuid, p_timezone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_total       INT;
  v_target_date DATE;
  v_envelope    JSONB;
BEGIN
  -- Derive the user-local date from the session's earliest review, so
  -- sessions_today counts within the day that contains this session,
  -- not "today" in absolute terms (covers the case where the user opens
  -- the summary the morning after a late-night session).
  SELECT (rl.reviewed_at AT TIME ZONE p_timezone)::DATE
    INTO v_target_date
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    ORDER BY rl.reviewed_at ASC
    LIMIT 1;

  WITH logs AS (
    SELECT rl.rating, rl.review_time_ms, rl.due_after
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    LIMIT 5000
  ),
  agg AS (
    SELECT
      COUNT(*)::INT                                                AS total,
      COUNT(*) FILTER (WHERE rating = 'again')::INT                AS again_count,
      COUNT(*) FILTER (WHERE rating = 'hard')::INT                 AS hard_count,
      COUNT(*) FILTER (WHERE rating = 'good')::INT                 AS good_count,
      COUNT(*) FILTER (WHERE rating = 'easy')::INT                 AS easy_count,
      COALESCE(SUM(COALESCE(review_time_ms, 0)), 0)::BIGINT        AS total_time_ms,
      MIN(due_after)                                               AS next_due_at
    FROM logs
  ),
  weak_spots_with_cards AS (
    SELECT
      l.id          AS weak_spot_id,
      l.card_id,
      c.deck_id,
      c.fields_data->>'word'    AS word,
      c.fields_data->>'reading' AS reading,
      c.lapses,
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.weak_spots l
    LEFT JOIN public.cards c ON c.id = l.card_id
    WHERE l.session_id = p_session_id
      AND l.user_id    = p_user_id
  ),
  user_total AS (
    -- Cap at 2: we only need to know "first session ever" vs. "returning".
    -- Using a subquery with LIMIT prevents a full table scan when the
    -- learner has thousands of sessions in their history.
    SELECT LEAST((SELECT COUNT(DISTINCT session_id) FROM (
      SELECT session_id FROM public.review_logs
        WHERE user_id = p_user_id AND session_id IS NOT NULL
        LIMIT 2
    ) AS s), 2)::INT AS total_sessions
  ),
  sessions_in_day AS (
    SELECT COUNT(DISTINCT rl.session_id)::INT AS cnt
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND v_target_date IS NOT NULL
      AND (rl.reviewed_at AT TIME ZONE p_timezone)::DATE = v_target_date
  )
  SELECT a.total INTO v_total FROM agg a;

  IF v_total = 0 OR v_total IS NULL THEN
    RAISE EXCEPTION 'session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'No review logs found for this session.';
  END IF;

  -- Re-run the CTE chain for the envelope build. (Matches the established
  -- pattern of the original function.)
  WITH logs AS (
    SELECT rl.rating, rl.review_time_ms, rl.due_after
    FROM public.review_logs rl
    WHERE rl.session_id = p_session_id
      AND rl.user_id    = p_user_id
    LIMIT 5000
  ),
  agg AS (
    SELECT
      COUNT(*)::INT                                                AS total,
      COUNT(*) FILTER (WHERE rating = 'again')::INT                AS again_count,
      COUNT(*) FILTER (WHERE rating = 'hard')::INT                 AS hard_count,
      COUNT(*) FILTER (WHERE rating = 'good')::INT                 AS good_count,
      COUNT(*) FILTER (WHERE rating = 'easy')::INT                 AS easy_count,
      COALESCE(SUM(COALESCE(review_time_ms, 0)), 0)::BIGINT        AS total_time_ms,
      MIN(due_after)                                               AS next_due_at
    FROM logs
  ),
  weak_spots_with_cards AS (
    SELECT
      l.id          AS weak_spot_id,
      l.card_id,
      c.deck_id,
      c.fields_data->>'word'    AS word,
      c.fields_data->>'reading' AS reading,
      c.lapses,
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.weak_spots l
    LEFT JOIN public.cards c ON c.id = l.card_id
    WHERE l.session_id = p_session_id
      AND l.user_id    = p_user_id
  ),
  user_total AS (
    SELECT LEAST((SELECT COUNT(DISTINCT session_id) FROM (
      SELECT session_id FROM public.review_logs
        WHERE user_id = p_user_id AND session_id IS NOT NULL
        LIMIT 2
    ) AS s), 2)::INT AS total_sessions
  ),
  sessions_in_day AS (
    SELECT COALESCE(COUNT(DISTINCT rl.session_id), 0)::INT AS cnt
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND v_target_date IS NOT NULL
      AND (rl.reviewed_at AT TIME ZONE p_timezone)::DATE = v_target_date
  )
  SELECT jsonb_build_object(
    'total',         a.total,
    'breakdown',     jsonb_build_object(
                       'again', a.again_count,
                       'hard',  a.hard_count,
                       'good',  a.good_count,
                       'easy',  a.easy_count
                     ),
    'total_time_ms', a.total_time_ms,
    'next_due_at',   a.next_due_at,
    'weak_spots',       COALESCE(
                       (SELECT jsonb_agg(jsonb_build_object(
                          'weak_spot_id',     l.weak_spot_id,
                          'card_id',      l.card_id,
                          'deck_id',      l.deck_id,
                          'word',         l.word,
                          'reading',      l.reading,
                          'lapses',       l.lapses,
                          'diagnosis',    l.diagnosis,
                          'prescription', l.prescription,
                          'resolved',     l.resolved,
                          'created_at',   l.created_at
                        ))
                        FROM weak_spots_with_cards l),
                       '[]'::jsonb
                     ),
    'user_total_sessions', (SELECT total_sessions FROM user_total),
    'sessions_today',      (SELECT cnt            FROM sessions_in_day)
  ) INTO v_envelope
  FROM agg a;

  RETURN v_envelope;
END;
$function$

;

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
      sc.weak_spot_id,
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
          'weakSpotId',    weak_spot_id,
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
$function$

;

CREATE OR REPLACE FUNCTION public.process_review(p_card_id uuid, p_user_id uuid, p_state integer, p_due timestamp with time zone, p_stability double precision, p_difficulty double precision, p_elapsed_days integer, p_scheduled_days integer, p_learning_steps integer, p_reps integer, p_lapses integer, p_last_review timestamp with time zone, p_updated_at timestamp with time zone, p_rating review_rating, p_review_time_ms integer, p_stability_after double precision, p_difficulty_after double precision, p_due_after timestamp with time zone, p_scheduled_days_after integer, p_weak_spot_threshold integer, p_state_before integer DEFAULT NULL::integer, p_stability_before double precision DEFAULT NULL::double precision, p_difficulty_before double precision DEFAULT NULL::double precision, p_due_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_scheduled_days_before integer DEFAULT NULL::integer, p_learning_steps_before integer DEFAULT NULL::integer, p_elapsed_days_before integer DEFAULT NULL::integer, p_last_review_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_reps_before integer DEFAULT NULL::integer, p_lapses_before integer DEFAULT NULL::integer, p_session_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_card_owner UUID;
  v_log_id     UUID;
BEGIN
  -- Lock the row for the duration of this function. Concurrent process_review
  -- calls for the same card_id will block here until the first commits.
  SELECT user_id INTO v_card_owner
    FROM public.cards
   WHERE id = p_card_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified card does not exist.';
  END IF;

  IF v_card_owner IS NULL THEN
    RAISE EXCEPTION 'cannot_review_source_card'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'Submit reviews against your personal copy of this card, not the premade source.';
  END IF;

  IF v_card_owner != p_user_id THEN
    RAISE EXCEPTION 'card_ownership_mismatch'
      USING ERRCODE = 'insufficient_privilege',
            HINT    = 'The specified card does not belong to this user.';
  END IF;

  -- Archive gate (20260625000000): reject reviews on cards whose deck is
  -- archived. Custom SQLSTATE 'P0420' → TS maps to 422 DECK_ARCHIVED.
  IF EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.decks d ON d.id = c.deck_id
    WHERE c.id = p_card_id
      AND d.archived_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'deck_archived'
      USING ERRCODE = 'P0420',
            HINT    = 'The deck containing this card is archived. Unarchive it before reviewing.';
  END IF;

  UPDATE public.cards
  SET
    due            = p_due,
    stability      = p_stability,
    difficulty     = p_difficulty,
    elapsed_days   = p_elapsed_days,
    scheduled_days = p_scheduled_days,
    learning_steps = p_learning_steps,
    reps           = p_reps,
    lapses         = p_lapses,
    state          = p_state,
    last_review    = p_last_review,
    updated_at     = p_updated_at
  WHERE id = p_card_id
    AND user_id = p_user_id;

  INSERT INTO public.review_logs (
    card_id, user_id, rating, review_time_ms,
    stability_after, difficulty_after, due_after, scheduled_days_after,
    state_before, stability_before, difficulty_before, due_before,
    scheduled_days_before, learning_steps_before, elapsed_days_before,
    last_review_before, reps_before, lapses_before, session_id
  ) VALUES (
    p_card_id, p_user_id, p_rating, p_review_time_ms,
    p_stability_after, p_difficulty_after, p_due_after, p_scheduled_days_after,
    p_state_before, p_stability_before, p_difficulty_before, p_due_before,
    p_scheduled_days_before, p_learning_steps_before, p_elapsed_days_before,
    p_last_review_before, p_reps_before, p_lapses_before, p_session_id
  )
  RETURNING id INTO v_log_id;

  IF p_lapses >= p_weak_spot_threshold THEN
    INSERT INTO public.weak_spots (card_id, user_id, session_id)
    SELECT p_card_id, p_user_id, p_session_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM   public.weak_spots l
      WHERE  l.card_id  = p_card_id
        AND  l.user_id  = p_user_id
        AND  l.resolved = FALSE
    );
  END IF;

  RETURN v_log_id;
END;
$function$

;

CREATE OR REPLACE FUNCTION public.process_review_batch(p_user_id uuid, p_reviews jsonb, p_weak_spot_threshold integer)
 RETURNS TABLE(card_id uuid, success boolean, error_message text, due timestamp with time zone, stability double precision, difficulty double precision, scheduled_days integer, state integer, review_log_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r            RECORD;
  v_card_owner UUID;
  v_log_id     UUID;
BEGIN
  FOR r IN
    SELECT *
    FROM jsonb_to_recordset(p_reviews) AS x(
      card_id                  UUID,
      rating                   public.review_rating,
      review_time_ms           INT,
      session_id               UUID,
      p_state                  INT,
      p_due                    TIMESTAMPTZ,
      p_stability              FLOAT,
      p_difficulty             FLOAT,
      p_elapsed_days           INT,
      p_scheduled_days         INT,
      p_learning_steps         INT,
      p_reps                   INT,
      p_lapses                 INT,
      p_last_review            TIMESTAMPTZ,
      p_state_before           INT,
      p_stability_before       FLOAT,
      p_difficulty_before      FLOAT,
      p_due_before             TIMESTAMPTZ,
      p_scheduled_days_before  INT,
      p_learning_steps_before  INT,
      p_elapsed_days_before    INT,
      p_last_review_before     TIMESTAMPTZ,
      p_reps_before            INT,
      p_lapses_before          INT
    )
  LOOP
    BEGIN
      v_log_id := NULL;

      SELECT user_id INTO v_card_owner
        FROM public.cards
       WHERE id = r.card_id
         FOR UPDATE;

      IF NOT FOUND THEN
        card_id        := r.card_id;
        success        := FALSE;
        error_message  := 'card_not_found';
        due            := NULL;
        stability      := NULL;
        difficulty     := NULL;
        scheduled_days := NULL;
        state          := NULL;
        review_log_id  := NULL;
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF v_card_owner IS NULL THEN
        card_id        := r.card_id;
        success        := FALSE;
        error_message  := 'cannot_review_source_card';
        due            := NULL;
        stability      := NULL;
        difficulty     := NULL;
        scheduled_days := NULL;
        state          := NULL;
        review_log_id  := NULL;
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF v_card_owner <> p_user_id THEN
        card_id        := r.card_id;
        success        := FALSE;
        error_message  := 'card_ownership_mismatch';
        due            := NULL;
        stability      := NULL;
        difficulty     := NULL;
        scheduled_days := NULL;
        state          := NULL;
        review_log_id  := NULL;
        RETURN NEXT;
        CONTINUE;
      END IF;

      UPDATE public.cards
      SET
        due            = r.p_due,
        stability      = r.p_stability,
        difficulty     = r.p_difficulty,
        elapsed_days   = r.p_elapsed_days,
        scheduled_days = r.p_scheduled_days,
        learning_steps = r.p_learning_steps,
        reps           = r.p_reps,
        lapses         = r.p_lapses,
        state          = r.p_state,
        last_review    = r.p_last_review,
        updated_at     = r.p_last_review
      WHERE id = r.card_id
        AND user_id = p_user_id;

      INSERT INTO public.review_logs (
        card_id, user_id, rating, review_time_ms,
        stability_after, difficulty_after, due_after, scheduled_days_after,
        state_before, stability_before, difficulty_before, due_before,
        scheduled_days_before, learning_steps_before, elapsed_days_before,
        last_review_before, reps_before, lapses_before, session_id
      ) VALUES (
        r.card_id, p_user_id, r.rating, r.review_time_ms,
        r.p_stability, r.p_difficulty, r.p_due, r.p_scheduled_days,
        r.p_state_before, r.p_stability_before, r.p_difficulty_before, r.p_due_before,
        r.p_scheduled_days_before, r.p_learning_steps_before, r.p_elapsed_days_before,
        r.p_last_review_before, r.p_reps_before, r.p_lapses_before, r.session_id
      )
      RETURNING id INTO v_log_id;

      IF r.p_lapses >= p_weak_spot_threshold THEN
        INSERT INTO public.weak_spots (card_id, user_id, session_id)
        SELECT r.card_id, p_user_id, r.session_id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.weak_spots l
          WHERE l.card_id  = r.card_id
            AND l.user_id  = p_user_id
            AND l.resolved = FALSE
        );
      END IF;

      card_id        := r.card_id;
      success        := TRUE;
      error_message  := NULL;
      due            := r.p_due;
      stability      := r.p_stability;
      difficulty     := r.p_difficulty;
      scheduled_days := r.p_scheduled_days;
      state          := r.p_state;
      review_log_id  := v_log_id;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      card_id        := r.card_id;
      success        := FALSE;
      error_message  := SQLERRM;
      due            := NULL;
      stability      := NULL;
      difficulty     := NULL;
      scheduled_days := NULL;
      state          := NULL;
      review_log_id  := NULL;
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$function$

;

CREATE OR REPLACE FUNCTION public.record_weak_spot_drill_attempt(p_user_id uuid, p_session_id uuid, p_event_id uuid, p_session_card_id uuid, p_asserted_card_id uuid, p_asserted_weak_spot_id uuid, p_result text, p_local_sequence integer, p_response_time_ms integer, p_shown_at timestamp with time zone, p_answered_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_canonical_card_id  UUID;
  v_canonical_weak_spot_id UUID;
  v_session_card_owner UUID;
  v_session_card_found BOOLEAN;
  v_attempt_id         UUID;
BEGIN
  -- 1. Look up the canonical card_id/weak_spot_id and verify the
  --    (session_card_id, session_id, user_id) triple matches a real row.
  --    Cross-user attempts return NOT FOUND → 404 (intentional opacity).
  SELECT card_id, weak_spot_id, user_id, TRUE
    INTO v_canonical_card_id, v_canonical_weak_spot_id, v_session_card_owner, v_session_card_found
    FROM public.weak_spot_drill_session_cards
    WHERE id = p_session_card_id
      AND session_id = p_session_id;

  IF v_session_card_found IS NOT TRUE OR v_session_card_owner IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'weak_spot_drill_session_card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT = 'sessionCardId not found, or sessionId/user mismatch.';
  END IF;

  -- 2. Consistency assertions. The client's body cardId/weak_spotId, when
  --    supplied, MUST match the canonical values on session_cards. This
  --    catches client bugs early rather than letting an attempt log under
  --    a misattributed card.
  IF p_asserted_card_id IS NOT NULL
     AND p_asserted_card_id IS DISTINCT FROM v_canonical_card_id THEN
    RAISE EXCEPTION 'weak_spot_drill_attempt_card_mismatch'
      USING ERRCODE = '22000',
            HINT = 'Body cardId does not match session_card.card_id.';
  END IF;
  IF p_asserted_weak_spot_id IS NOT NULL
     AND p_asserted_weak_spot_id IS DISTINCT FROM v_canonical_weak_spot_id THEN
    RAISE EXCEPTION 'weak_spot_drill_attempt_weak_spot_mismatch'
      USING ERRCODE = '22000',
            HINT = 'Body weak_spotId does not match session_card.weak_spot_id.';
  END IF;

  -- 3. INSERT with ON CONFLICT DO NOTHING for eventId idempotency. The
  --    UNIQUE (user_id, event_id) constraint makes this both safe and
  --    idempotent: a duplicate eventId leaves v_attempt_id NULL, and the
  --    follow-up SELECT recovers the prior row.
  --
  --    Note: the INSERT uses the CANONICAL weak_spot_id/card_id from step 1,
  --    not the body's assertions. The wire-side values are downgraded to
  --    consistency checks; the data on the row is always sourced from
  --    session_cards.
  INSERT INTO public.weak_spot_drill_attempts (
    event_id, session_id, session_card_id,
    weak_spot_id, card_id, user_id,
    result, local_sequence, response_time_ms,
    shown_at, answered_at
  ) VALUES (
    p_event_id, p_session_id, p_session_card_id,
    v_canonical_weak_spot_id, v_canonical_card_id, p_user_id,
    p_result, p_local_sequence, p_response_time_ms,
    p_shown_at, COALESCE(p_answered_at, NOW())
  )
  ON CONFLICT (user_id, event_id) DO NOTHING
  RETURNING id INTO v_attempt_id;

  -- 4. If the INSERT was deduplicated, fetch the existing row's id.
  IF v_attempt_id IS NULL THEN
    SELECT id INTO v_attempt_id
      FROM public.weak_spot_drill_attempts
      WHERE user_id = p_user_id AND event_id = p_event_id;
  END IF;

  -- 5. Build the response envelope from the canonical row state. Whether
  --    the row was freshly inserted or replayed, the consumer sees the
  --    same shape.
  RETURN (
    SELECT jsonb_build_object(
      'attemptId',      a.id,
      'eventId',        a.event_id,
      'sessionId',      a.session_id,
      'sessionCardId',  a.session_card_id,
      'weak_spotId',        a.weak_spot_id,
      'cardId',         a.card_id,
      'result',         a.result,
      'localSequence',  a.local_sequence,
      'responseTimeMs', a.response_time_ms,
      'shownAt',        a.shown_at,
      'answeredAt',     a.answered_at,
      'createdAt',      a.created_at
    )
    FROM public.weak_spot_drill_attempts a
    WHERE a.id = v_attempt_id
  );
END;
$function$

;

CREATE OR REPLACE FUNCTION public.transition_weak_spot_drill_session(p_user_id uuid, p_session_id uuid, p_target_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Lock the session row + ownership check + read current status atomically.
  -- FOR UPDATE guards against concurrent transitions on the same session row
  -- (e.g. two tabs both clicking "Finish" near-simultaneously).
  SELECT status
    INTO v_current_status
    FROM public.weak_spot_drill_sessions
    WHERE id = p_session_id
      AND user_id = p_user_id
    FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'weak_spot_drill_session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT = 'Session does not exist or does not belong to this user.';
  END IF;

  -- Idempotent no-op: re-finishing a finished session or re-aborting an
  -- aborted one returns successfully without touching finished_at. The
  -- COALESCE below preserves the original first-finish timestamp on retries,
  -- same pattern as Stage 2's resolveWeakSpot preserving the original
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
    RAISE EXCEPTION 'weak_spot_drill_session_state_conflict'
      USING ERRCODE = '22000',
            HINT = format('Cannot transition session from %s to %s.', v_current_status, p_target_status);
  END IF;

  IF p_target_status NOT IN ('finished', 'aborted') THEN
    RAISE EXCEPTION 'weak_spot_drill_session_state_conflict'
      USING ERRCODE = '22000',
            HINT = format('Unknown target status: %s.', p_target_status);
  END IF;

  UPDATE public.weak_spot_drill_sessions
     SET status      = p_target_status,
         finished_at = COALESCE(finished_at, NOW()),
         updated_at  = NOW()
   WHERE id = p_session_id
     AND user_id = p_user_id;
END;
$function$

;


-- ── 6. Re-grant the dropped functions ───────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace
             AND proname IN ('process_review','process_review_batch','record_weak_spot_drill_attempt')
  LOOP
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO anon, authenticated, service_role';
  END LOOP;
END $$;
