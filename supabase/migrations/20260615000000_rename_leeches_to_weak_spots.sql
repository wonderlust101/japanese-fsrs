-- =============================================================
-- Migration: 20260615000000_rename_leeches_to_weak_spots.sql
--
-- Renames every "leech" identifier to "weak_spot" in the database
-- layer so the schema, RPCs, and constraints match the canonical
-- learner-facing label decided in the 2026-05-18 IA discussion.
--
-- User-facing copy has long been split across three terms — "weak
-- spots" (the navigation surface), "leech" (the inherited Anki noun
-- carried into the Pill / drill copy), and "Problem Card" (the IA
-- wireframes + the /cards/:id/repair stub). This migration is the
-- backend half of the unification; the frontend, IA docs, and
-- PRODUCT.md are unified in the same PR.
--
-- Strategy:
--   1. ALTER TABLE … RENAME the four tables. Indexes, FKs, RLS
--      policies travel with the table because PostgreSQL tracks
--      them by OID. We rename them explicitly anyway so future
--      readers don't see a `weak_spots` table with a
--      `leeches_card_user_unresolved_idx` index — confusing.
--   2. plpgsql function bodies that reference the old table names
--      are stored as text in pg_proc.prosrc; the OID-level
--      dependency does not survive a name lookup at parse time.
--      So we CREATE OR REPLACE every function that touches the old
--      names: process_review, process_review_batch,
--      get_session_summary (which all INSERT/SELECT into leeches)
--      and the four drill RPCs (whose names also change).
--   3. The drill RPCs change name (create_leech_drill_session →
--      create_weak_spot_drill_session, etc.). CREATE OR REPLACE
--      can't rename — DROP + CREATE under the new name.
--      GRANT EXECUTE TO service_role is re-issued explicitly per
--      docs/DATABASE.md.
--
-- Reversibility: a mirror migration could rename back, but it
-- would also have to rewrite every consumer (API routes, frontend
-- components, etc). Treat one-way.
-- =============================================================


-- ─── 1. Rename tables ────────────────────────────────────────────────────────

ALTER TABLE public.leeches                    RENAME TO weak_spots;
ALTER TABLE public.leech_drill_sessions       RENAME TO weak_spot_drill_sessions;
ALTER TABLE public.leech_drill_session_cards  RENAME TO weak_spot_drill_session_cards;
ALTER TABLE public.leech_drill_attempts       RENAME TO weak_spot_drill_attempts;


-- ─── 2. Rename indexes for clarity ───────────────────────────────────────────

ALTER INDEX public.leeches_user_id_idx                         RENAME TO weak_spots_user_id_idx;
ALTER INDEX public.leeches_card_id_idx                         RENAME TO weak_spots_card_id_idx;
ALTER INDEX public.leeches_card_user_unresolved_idx            RENAME TO weak_spots_card_user_unresolved_idx;
ALTER INDEX public.leeches_session_id_idx                      RENAME TO weak_spots_session_id_idx;
ALTER INDEX public.leeches_user_id_unresolved_idx              RENAME TO weak_spots_user_id_unresolved_idx;
ALTER INDEX public.leech_drill_sessions_user_created_idx       RENAME TO weak_spot_drill_sessions_user_created_idx;
ALTER INDEX public.leech_drill_sessions_user_active_idx        RENAME TO weak_spot_drill_sessions_user_active_idx;
ALTER INDEX public.leech_drill_session_cards_user_card_idx     RENAME TO weak_spot_drill_session_cards_user_card_idx;
ALTER INDEX public.leech_drill_session_cards_session_card_idx  RENAME TO weak_spot_drill_session_cards_session_card_idx;
ALTER INDEX public.leech_drill_session_cards_leech_idx         RENAME TO weak_spot_drill_session_cards_weak_spot_idx;
ALTER INDEX public.leech_drill_attempts_user_created_idx       RENAME TO weak_spot_drill_attempts_user_created_idx;
ALTER INDEX public.leech_drill_attempts_leech_created_idx      RENAME TO weak_spot_drill_attempts_weak_spot_created_idx;


-- ─── 3. Recreate process_review with renamed table reference ────────────────

CREATE OR REPLACE FUNCTION process_review(
  p_card_id              UUID,
  p_user_id              UUID,
  p_state                INT,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_elapsed_days         INT,
  p_scheduled_days       INT,
  p_learning_steps       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_last_review          TIMESTAMPTZ,
  p_updated_at           TIMESTAMPTZ,
  p_rating               review_rating,
  p_review_time_ms       INT,
  p_stability_after      FLOAT,
  p_difficulty_after     FLOAT,
  p_due_after            TIMESTAMPTZ,
  p_scheduled_days_after INT,
  p_leech_threshold      INT,
  p_state_before          INT         DEFAULT NULL,
  p_stability_before      FLOAT       DEFAULT NULL,
  p_difficulty_before     FLOAT       DEFAULT NULL,
  p_due_before            TIMESTAMPTZ DEFAULT NULL,
  p_scheduled_days_before INT         DEFAULT NULL,
  p_learning_steps_before INT         DEFAULT NULL,
  p_elapsed_days_before   INT         DEFAULT NULL,
  p_last_review_before    TIMESTAMPTZ DEFAULT NULL,
  p_reps_before           INT         DEFAULT NULL,
  p_lapses_before         INT         DEFAULT NULL,
  p_session_id            UUID        DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card_owner UUID;
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
  );

  IF p_lapses >= p_leech_threshold THEN
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
END;
$$;


-- ─── 4. Recreate process_review_batch ──────────────────────────────────────

CREATE OR REPLACE FUNCTION process_review_batch(
  p_user_id          UUID,
  p_reviews          JSONB,
  p_leech_threshold  INT
)
RETURNS TABLE(
  card_id        UUID,
  success        BOOLEAN,
  error_message  TEXT,
  due            TIMESTAMPTZ,
  stability      FLOAT,
  difficulty     FLOAT,
  scheduled_days INT,
  state          INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r            RECORD;
  v_card_owner UUID;
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
      -- Lock the row + ownership check (same pattern as process_review).
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
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Persist FSRS state.
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

      -- Append review log.
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
      );

      -- Leech detection (skip if an unresolved leech already exists).
      IF r.p_lapses >= p_leech_threshold THEN
        INSERT INTO public.weak_spots (card_id, user_id, session_id)
        SELECT r.card_id, p_user_id, r.session_id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.weak_spots l
          WHERE l.card_id  = r.card_id
            AND l.user_id  = p_user_id
            AND l.resolved = FALSE
        );
      END IF;

      -- Success row.
      card_id        := r.card_id;
      success        := TRUE;
      error_message  := NULL;
      due            := r.p_due;
      stability      := r.p_stability;
      difficulty     := r.p_difficulty;
      scheduled_days := r.p_scheduled_days;
      state          := r.p_state;
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
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;


-- ─── 5. Recreate get_session_summary ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_session_summary(
  p_session_id UUID,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INT;
  v_envelope JSONB;
BEGIN
  -- Aggregate stats from review_logs (capped at 5000 rows for safety).
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
  leeches_with_cards AS (
    SELECT
      l.id          AS leech_id,
      l.card_id,
      c.deck_id,
      c.fields_data->>'word'    AS word,
      c.fields_data->>'reading' AS reading,
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.weak_spots l
    LEFT JOIN public.cards c ON c.id = l.card_id
    WHERE l.session_id = p_session_id
      AND l.user_id    = p_user_id
  )
  SELECT a.total INTO v_total FROM agg a;

  IF v_total = 0 OR v_total IS NULL THEN
    RAISE EXCEPTION 'session_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'No review logs found for this session.';
  END IF;

  -- Re-run the CTE chain so jsonb_build_object can reference both agg and weak_spots.
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
  leeches_with_cards AS (
    SELECT
      l.id          AS leech_id,
      l.card_id,
      c.deck_id,
      c.fields_data->>'word'    AS word,
      c.fields_data->>'reading' AS reading,
      l.diagnosis,
      l.prescription,
      l.resolved,
      l.created_at
    FROM public.weak_spots l
    LEFT JOIN public.cards c ON c.id = l.card_id
    WHERE l.session_id = p_session_id
      AND l.user_id    = p_user_id
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
                          'leech_id',     l.leech_id,
                          'card_id',      l.card_id,
                          'deck_id',      l.deck_id,
                          'word',         l.word,
                          'reading',      l.reading,
                          'diagnosis',    l.diagnosis,
                          'prescription', l.prescription,
                          'resolved',     l.resolved,
                          'created_at',   l.created_at
                        ))
                        FROM leeches_with_cards l),
                       '[]'::jsonb
                     )
  ) INTO v_envelope
  FROM agg a;

  RETURN v_envelope;
END;
$$;


-- ─── 6. Drop old drill RPCs and create renamed versions ─────────────────────
-- ALTER FUNCTION ... RENAME would suffice for the names, but each body
-- still references the old `leech_drill_*` tables; DROP+CREATE rewrites
-- both. GRANT EXECUTE TO service_role is re-issued.

-- Stage 5 (20260601000000) defined the 11-arg signature; Stage 6
-- (20260603000000) added three params (`p_card_ids`, `p_card_id`,
-- `p_min_lapses`) via CREATE OR REPLACE without dropping the older
-- overload, so both exist on the live DB. Drop both to free the name
-- for the rename to create_weak_spot_drill_session.
DROP FUNCTION public.create_leech_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB
);
DROP FUNCTION public.create_leech_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB, UUID[], UUID, INT
);

CREATE OR REPLACE FUNCTION public.create_weak_spot_drill_session(
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
  INSERT INTO public.weak_spot_drill_sessions (
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
    FROM public.weak_spots l
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
        SELECT 1 FROM public.weak_spots existing
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
    INSERT INTO public.weak_spot_drill_session_cards (
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

GRANT EXECUTE ON FUNCTION public.create_weak_spot_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB, UUID[], UUID, INT
) TO service_role;


DROP FUNCTION public.get_leech_drill_session(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_weak_spot_drill_session(
  p_user_id    UUID,
  p_session_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
      c.card_type::text              AS card_type,
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
          'leechId',       leech_id,
          'cardId',        card_id,
          'ordinal',       ordinal,
          'layoutType',    layout_type,
          'cardType',      card_type,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_weak_spot_drill_session(UUID, UUID) TO service_role;


DROP FUNCTION public.record_leech_drill_attempt(
  UUID, UUID, UUID, UUID, UUID, UUID, TEXT, INT, INT, TIMESTAMPTZ, TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.record_weak_spot_drill_attempt(
  p_user_id           UUID,
  p_session_id        UUID,
  p_event_id          UUID,
  p_session_card_id   UUID,
  p_asserted_card_id  UUID,
  p_asserted_leech_id UUID,
  p_result            TEXT,
  p_local_sequence    INT,
  p_response_time_ms  INT,
  p_shown_at          TIMESTAMPTZ,
  p_answered_at       TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_canonical_card_id  UUID;
  v_canonical_leech_id UUID;
  v_session_card_owner UUID;
  v_session_card_found BOOLEAN;
  v_attempt_id         UUID;
BEGIN
  -- 1. Look up the canonical card_id/leech_id and verify the
  --    (session_card_id, session_id, user_id) triple matches a real row.
  --    Cross-user attempts return NOT FOUND → 404 (intentional opacity).
  SELECT card_id, leech_id, user_id, TRUE
    INTO v_canonical_card_id, v_canonical_leech_id, v_session_card_owner, v_session_card_found
    FROM public.weak_spot_drill_session_cards
    WHERE id = p_session_card_id
      AND session_id = p_session_id;

  IF v_session_card_found IS NOT TRUE OR v_session_card_owner IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'weak_spot_drill_session_card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT = 'sessionCardId not found, or sessionId/user mismatch.';
  END IF;

  -- 2. Consistency assertions. The client's body cardId/leechId, when
  --    supplied, MUST match the canonical values on session_cards. This
  --    catches client bugs early rather than letting an attempt log under
  --    a misattributed card.
  IF p_asserted_card_id IS NOT NULL
     AND p_asserted_card_id IS DISTINCT FROM v_canonical_card_id THEN
    RAISE EXCEPTION 'weak_spot_drill_attempt_card_mismatch'
      USING ERRCODE = '22000',
            HINT = 'Body cardId does not match session_card.card_id.';
  END IF;
  IF p_asserted_leech_id IS NOT NULL
     AND p_asserted_leech_id IS DISTINCT FROM v_canonical_leech_id THEN
    RAISE EXCEPTION 'weak_spot_drill_attempt_weak_spot_mismatch'
      USING ERRCODE = '22000',
            HINT = 'Body leechId does not match session_card.leech_id.';
  END IF;

  -- 3. INSERT with ON CONFLICT DO NOTHING for eventId idempotency. The
  --    UNIQUE (user_id, event_id) constraint makes this both safe and
  --    idempotent: a duplicate eventId leaves v_attempt_id NULL, and the
  --    follow-up SELECT recovers the prior row.
  --
  --    Note: the INSERT uses the CANONICAL leech_id/card_id from step 1,
  --    not the body's assertions. The wire-side values are downgraded to
  --    consistency checks; the data on the row is always sourced from
  --    session_cards.
  INSERT INTO public.weak_spot_drill_attempts (
    event_id, session_id, session_card_id,
    leech_id, card_id, user_id,
    result, local_sequence, response_time_ms,
    shown_at, answered_at
  ) VALUES (
    p_event_id, p_session_id, p_session_card_id,
    v_canonical_leech_id, v_canonical_card_id, p_user_id,
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
      'leechId',        a.leech_id,
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
$$;

GRANT EXECUTE ON FUNCTION public.record_weak_spot_drill_attempt(
  UUID, UUID, UUID, UUID, UUID, UUID, TEXT, INT, INT, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;


DROP FUNCTION public.transition_leech_drill_session(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.transition_weak_spot_drill_session(
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
$$;

GRANT EXECUTE ON FUNCTION public.transition_weak_spot_drill_session(UUID, UUID, TEXT) TO service_role;
