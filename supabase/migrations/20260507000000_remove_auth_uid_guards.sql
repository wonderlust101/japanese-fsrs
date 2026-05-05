-- =============================================================
-- Migration: 20260507000000_remove_auth_uid_guards.sql
-- Severity: CRITICAL — production-unblocking
--
-- Removes auth.uid() identity checks added in 20260504000009 from
-- every SECURITY DEFINER RPC. The Express API uses a static
-- service-role supabase client (apps/api/src/db/supabase.ts) that
-- does NOT forward user JWTs, so auth.uid() returns NULL inside
-- every RPC and the guards always raise 'access_denied'.
--
-- The service layer already enforces ownership before each RPC
-- call (e.g. processReview() filters by user_id and rejects
-- premade source cards before invoking process_review). The
-- parameter-based ownership checks inside the RPCs (WHERE id = ...
-- AND user_id = p_user_id, plus the explicit ownership raises in
-- process_review/process_forget) remain intact.
--
-- Closes audit findings C1 and C2 (the C2 regression in
-- 20260505000000 dropped the same guard from get_milestone_forecast;
-- this migration codifies that absence as the intended state).
-- =============================================================


-- ─── process_review ────────────────────────────────────────────────────────────
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
  -- Ownership raises (preserved from 20260504000009 guards 2-4):
  -- the service layer is the primary enforcer, but these prevent silent
  -- no-ops and surface clear errors when the parameter does not match
  -- the actual card row.
  SELECT user_id INTO v_card_owner
    FROM public.cards
   WHERE id = p_card_id;

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

  -- 1. Persist updated FSRS scheduling state on the card.
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

  -- 2. Append an immutable review log entry with optional before-snapshot.
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

  -- 3. Leech detection — insert only when threshold crossed and no unresolved
  --    leech already exists for this (card, user) pair.
  IF p_lapses >= p_leech_threshold THEN
    INSERT INTO public.leeches (card_id, user_id)
    SELECT p_card_id, p_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM   public.leeches l
      WHERE  l.card_id  = p_card_id
        AND  l.user_id  = p_user_id
        AND  l.resolved = FALSE
    );
  END IF;
END;
$$;


-- ─── process_forget ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_forget(
  p_card_id              UUID,
  p_user_id              UUID,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_scheduled_days       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_updated_at           TIMESTAMPTZ,
  p_state_before          INT,
  p_stability_before      FLOAT,
  p_difficulty_before     FLOAT,
  p_due_before            TIMESTAMPTZ,
  p_scheduled_days_before INT,
  p_learning_steps_before INT,
  p_elapsed_days_before   INT,
  p_last_review_before    TIMESTAMPTZ,
  p_reps_before           INT,
  p_lapses_before         INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card_owner UUID;
BEGIN
  SELECT user_id INTO v_card_owner
    FROM public.cards
   WHERE id = p_card_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_card_owner IS NULL THEN
    RAISE EXCEPTION 'cannot_forget_source_card'
      USING ERRCODE = 'invalid_parameter_value',
            HINT    = 'Forget your personal copy of this card, not the premade source.';
  END IF;

  IF v_card_owner != p_user_id THEN
    RAISE EXCEPTION 'card_ownership_mismatch'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.cards
  SET
    due            = p_due,
    stability      = p_stability,
    difficulty     = p_difficulty,
    elapsed_days   = 0,
    scheduled_days = p_scheduled_days,
    learning_steps = 0,
    reps           = p_reps,
    lapses         = p_lapses,
    state          = 0,
    last_review    = NULL,
    updated_at     = p_updated_at
  WHERE id = p_card_id
    AND user_id = p_user_id;

  INSERT INTO public.review_logs (
    card_id, user_id, rating,
    stability_after, difficulty_after, due_after, scheduled_days_after,
    state_before, stability_before, difficulty_before, due_before,
    scheduled_days_before, learning_steps_before, elapsed_days_before,
    last_review_before, reps_before, lapses_before
  ) VALUES (
    p_card_id, p_user_id, 'manual',
    p_stability, p_difficulty, p_due, p_scheduled_days,
    p_state_before, p_stability_before, p_difficulty_before, p_due_before,
    p_scheduled_days_before, p_learning_steps_before, p_elapsed_days_before,
    p_last_review_before, p_reps_before, p_lapses_before
  );
END;
$$;


-- ─── subscribe_to_premade_deck ────────────────────────────────────────────────
-- Note: this version preserves the 20260504000009 body unchanged except for
-- removing the auth.uid() block. Migration 20260507000003 will further amend
-- the cloning SELECT to carry source embeddings.
CREATE OR REPLACE FUNCTION subscribe_to_premade_deck(
  p_user_id         UUID,
  p_premade_deck_id UUID
)
RETURNS TABLE (
  subscription_id UUID,
  deck_id         UUID,
  card_count      INT,
  already_existed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_premade            public.premade_decks%ROWTYPE;
  v_existing_sub_id    UUID;
  v_existing_deck_id   UUID;
  v_existing_count     INT;
  v_new_sub_id         UUID;
  v_new_deck_id        UUID;
  v_inserted_count     INT;
BEGIN
  -- Step 1 — validate premade deck.
  SELECT * INTO v_premade
  FROM public.premade_decks
  WHERE id = p_premade_deck_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premade deck not found' USING ERRCODE = 'P0002';
  END IF;

  -- Step 2 — short-circuit if subscription already exists.
  SELECT s.id, d.id, d.card_count
    INTO v_existing_sub_id, v_existing_deck_id, v_existing_count
  FROM public.user_premade_subscriptions s
  JOIN public.decks d
    ON d.user_id           = s.user_id
   AND d.source_premade_id = s.premade_deck_id
   AND d.is_premade_fork   = TRUE
  WHERE s.user_id         = p_user_id
    AND s.premade_deck_id = p_premade_deck_id;

  IF v_existing_sub_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_sub_id, v_existing_deck_id, v_existing_count, TRUE;
    RETURN;
  END IF;

  -- Step 3 — create subscription, deck, and clone source cards atomically.
  INSERT INTO public.user_premade_subscriptions (user_id, premade_deck_id)
  VALUES (p_user_id, p_premade_deck_id)
  RETURNING id INTO v_new_sub_id;

  INSERT INTO public.decks (
    user_id, name, description, deck_type, is_premade_fork, source_premade_id
  )
  VALUES (
    p_user_id, v_premade.name, v_premade.description, v_premade.deck_type, TRUE, p_premade_deck_id
  )
  RETURNING id INTO v_new_deck_id;

  WITH cloned AS (
    INSERT INTO public.cards (
      user_id, deck_id, premade_deck_id,
      layout_type, fields_data, card_type, jlpt_level, tags,
      due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps,
      reps, lapses, state, last_review
    )
    SELECT
      p_user_id, v_new_deck_id, NULL,
      c.layout_type, c.fields_data, c.card_type, c.jlpt_level, COALESCE(c.tags, '{}'),
      NOW(), 0, 0,
      0, 0, 0,
      0, 0, 0, NULL
    FROM public.cards c
    WHERE c.premade_deck_id = p_premade_deck_id
      AND c.user_id IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_inserted_count FROM cloned;

  RETURN QUERY SELECT v_new_sub_id, v_new_deck_id, v_inserted_count, FALSE;
END;
$$;


-- ─── get_heatmap_data ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_heatmap_data(p_user_id UUID)
RETURNS TABLE(date TEXT, retention FLOAT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(rl.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')  AS date,
    ROUND(
      (COUNT(*) FILTER (WHERE rl.rating IN ('good', 'easy'))::NUMERIC
      / COUNT(*) * 100),
      1
    )                                                          AS retention,
    COUNT(*)                                                   AS count
  FROM public.review_logs rl
  WHERE rl.user_id    = p_user_id
    AND rl.reviewed_at >= NOW() - INTERVAL '365 days'
  GROUP BY TO_CHAR(rl.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  ORDER BY date;
END;
$$;


-- ─── get_accuracy_by_layout ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_accuracy_by_layout(p_user_id UUID)
RETURNS TABLE(layout TEXT, total BIGINT, successful BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.card_type::TEXT                                          AS layout,
    COUNT(*)                                                   AS total,
    COUNT(*) FILTER (WHERE rl.rating IN ('good', 'easy'))      AS successful
  FROM public.review_logs rl
  JOIN public.cards c ON c.id = rl.card_id
  WHERE rl.user_id = p_user_id
  GROUP BY c.card_type
  ORDER BY c.card_type;
END;
$$;


-- ─── get_streak ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_streak(p_user_id UUID)
RETURNS TABLE(current_streak INT, longest_streak INT, last_review_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE AS d
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
  ),
  grouped AS (
    SELECT d,
           d - (ROW_NUMBER() OVER (ORDER BY d))::INT AS grp
    FROM days
  ),
  runs AS (
    SELECT MIN(d) AS run_start, MAX(d) AS run_end, COUNT(*)::INT AS run_len
    FROM grouped
    GROUP BY grp
  ),
  current AS (
    SELECT COALESCE(MAX(run_len), 0) AS streak
    FROM runs
    WHERE run_end >= (CURRENT_DATE AT TIME ZONE 'UTC')::DATE - INTERVAL '1 day'
  ),
  longest AS (
    SELECT COALESCE(MAX(run_len), 0) AS streak FROM runs
  ),
  last_d AS (
    SELECT MAX(d) AS d FROM days
  )
  SELECT current.streak::INT, longest.streak::INT, last_d.d
  FROM current, longest, last_d;
END;
$$;


-- ─── get_jlpt_gap ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_jlpt_gap(p_user_id UUID)
RETURNS TABLE(jlpt_level TEXT, total BIGINT, learned BIGINT, due BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.jlpt_level::TEXT                                            AS jlpt_level,
    COUNT(*)                                                      AS total,
    COUNT(*) FILTER (WHERE c.state >= 2)                          AS learned,
    COUNT(*) FILTER (WHERE c.due <= NOW() AND NOT c.is_suspended) AS due
  FROM public.cards c
  WHERE c.user_id = p_user_id
    AND c.jlpt_level IS NOT NULL
  GROUP BY c.jlpt_level
  ORDER BY c.jlpt_level;
END;
$$;


-- ─── get_milestone_forecast (closes C2) ────────────────────────────────────────
-- Already without auth.uid() guard after migration 20260505000000.
-- Rewriting here so the absence is explicit and consistent with the rest.
DROP FUNCTION IF EXISTS get_milestone_forecast(UUID);

CREATE FUNCTION get_milestone_forecast(p_user_id UUID)
RETURNS TABLE(
  jlpt_level                  TEXT,
  total                       BIGINT,
  learned                     BIGINT,
  daily_pace                  FLOAT8,
  days_remaining              INT,
  projected_completion_date   DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH pace AS (
    SELECT
      CASE
        WHEN COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE) = 0 THEN 0
        ELSE COUNT(*)::NUMERIC
             / GREATEST(COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE), 1)
      END AS rate
    FROM public.review_logs rl
    WHERE rl.user_id = p_user_id
      AND rl.reviewed_at >= NOW() - INTERVAL '30 days'
      AND rl.state_before IS NOT NULL
      AND rl.state_before < 2
      AND rl.rating IN ('good', 'easy')
  ),
  per_level AS (
    SELECT
      c.jlpt_level::TEXT                       AS jlpt_level,
      COUNT(*)                                 AS total,
      COUNT(*) FILTER (WHERE c.state >= 2)     AS learned
    FROM public.cards c
    WHERE c.user_id = p_user_id
      AND c.jlpt_level IS NOT NULL
    GROUP BY c.jlpt_level
  )
  SELECT
    pl.jlpt_level,
    pl.total,
    pl.learned,
    (p.rate)::FLOAT8                                   AS daily_pace,
    CASE
      WHEN p.rate IS NULL OR p.rate = 0 THEN NULL
      ELSE CEIL(GREATEST(pl.total - pl.learned, 0) / p.rate)::INT
    END                                                AS days_remaining,
    CASE
      WHEN p.rate IS NULL OR p.rate = 0 THEN NULL
      ELSE (CURRENT_DATE
        + (CEIL(GREATEST(pl.total - pl.learned, 0) / p.rate)::INT) * INTERVAL '1 day')::DATE
    END                                                AS projected_completion_date
  FROM per_level pl, pace p
  ORDER BY pl.jlpt_level;
$$;


-- ─── find_similar_cards ────────────────────────────────────────────────────────
-- 20260504000009 changed the WHERE to bind to auth.uid() and ignore p_user_id,
-- which silently returns zero rows when called from the service-role API
-- because auth.uid() is NULL. Restore parameter-based filtering.
--
-- NOTE: deliberately no SET search_path here. The function is LANGUAGE sql
-- (not SECURITY DEFINER), so it runs with the caller's privileges and
-- doesn't need search_path hardening. More importantly, locking search_path
-- to '' would hide the pgvector <=> cosine-distance operator (which lives
-- in whatever schema CREATE EXTENSION put the vector type in — typically
-- public or extensions) and produce
-- "operator does not exist: vector <=> vector".
CREATE OR REPLACE FUNCTION find_similar_cards(
  p_card_id UUID,
  p_user_id UUID,
  p_limit   INT DEFAULT 10
)
RETURNS TABLE (
  id UUID, deck_id UUID, layout_type layout_type,
  card_type card_type, fields_data JSONB,
  tags TEXT[], jlpt_level jlpt_level, similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id, c.deck_id, c.layout_type,
    c.card_type, c.fields_data,
    c.tags, c.jlpt_level,
    (c.embedding <=> (SELECT embedding FROM public.cards WHERE id = p_card_id))::FLOAT AS similarity
  FROM public.cards c
  WHERE c.user_id = p_user_id
    AND c.id != p_card_id
    AND c.embedding IS NOT NULL
  ORDER BY similarity ASC
  LIMIT p_limit;
$$;
