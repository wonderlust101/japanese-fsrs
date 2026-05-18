-- =============================================================
-- Migration: 20260614000000_drop_card_type.sql
--
-- Collapses the cognitive-modality split. The `card_type` enum
-- (`comprehension | production | listening`) and the matching
-- `cards.card_type` column are dropped end-to-end. From now on every
-- card is scheduled with a single FSRS instance at
-- `request_retention = 0.85` (the existing `profiles.retention_target`
-- default).
--
-- Why now: the AI generator was never wired to produce a listening
-- card, the review-session components never rendered different layouts
-- per modality, and `parent_card_id` was never used to fan one input
-- into multiple modality siblings. The split was structurally present
-- in the DB and the scheduler map (`fsrs.service.ts:63–67`) but did
-- nothing for the learner — only added a dimension to analytics
-- rollups and forced every review path to pick a scheduler.
--
-- Bonus fix bundled in: `get_accuracy_by_layout` has long been a
-- misnomer — it returned a column named `layout` but grouped by
-- `c.card_type::TEXT`. We rename it to `get_accuracy_by_layout_type`
-- and switch the GROUP BY to `c.layout_type` (`vocabulary | grammar |
-- sentence`) — the dimension the column name always claimed. Renaming
-- means consumers fail loudly rather than silently switching meaning.
--
-- Pre-existing FSRS state numbers (`stability`, `difficulty`,
-- `scheduled_days`, etc.) keep their meaning regardless of the
-- retention target — only *future* intervals shift. Cards that were
-- previously scheduled with 0.90 (comprehension) loosen slightly to
-- 0.85; cards on 0.82 (listening) tighten slightly. No data backfill
-- is required.
--
-- Order of operations:
--   1. DROP+CREATE every RPC that takes or returns card_type (the
--      type cannot be dropped while functions depend on it). Each
--      DROP+CREATE re-issues GRANT EXECUTE ... TO service_role and
--      keeps the SECURITY DEFINER + SET search_path = '' contract
--      where it was already pinned.
--   2. CREATE OR REPLACE the function bodies that merely reference
--      card_type in their body (no signature change required) — the
--      copy_premade_deck INSERT loses the column.
--   3. ALTER TABLE public.cards DROP COLUMN card_type.
--   4. DROP TYPE public.card_type.
--
-- Reversibility: irreversible without a backup. Once the column is
-- dropped, the modality assignment is lost. There was no live data
-- distinguishing the three values in production (all premade-source
-- rows were seeded with 'comprehension'); user-created cards
-- defaulted to 'comprehension' at the schema layer. Take a Supabase
-- snapshot before applying in any environment that has user data.
-- =============================================================


-- ─── 1A. update_card_with_sibling_sync — drop p_card_type ─────────────────────

DROP FUNCTION public.update_card_with_sibling_sync(
  UUID, UUID, INT, JSONB, public.layout_type, public.card_type, TEXT[], public.jlpt_level
);

CREATE FUNCTION public.update_card_with_sibling_sync(
  p_card_id          UUID,
  p_user_id          UUID,
  p_expected_version INT,
  p_fields_data      JSONB                DEFAULT NULL,
  p_layout_type      public.layout_type   DEFAULT NULL,
  p_tags             TEXT[]               DEFAULT NULL,
  p_jlpt_level       public.jlpt_level    DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  deck_id         UUID,
  premade_deck_id UUID,
  layout_type     public.layout_type,
  fields_data     JSONB,
  parent_card_id  UUID,
  tags            TEXT[],
  jlpt_level      public.jlpt_level,
  state           INT,
  is_suspended    BOOLEAN,
  due             TIMESTAMPTZ,
  stability       FLOAT,
  difficulty      FLOAT,
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
    tags        = COALESCE(p_tags,        tags),
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
           c.fields_data, c.parent_card_id, c.tags, c.jlpt_level,
           c.state, c.is_suspended, c.due, c.stability, c.difficulty,
           c.elapsed_days, c.scheduled_days, c.learning_steps, c.reps, c.lapses,
           c.last_review, c.version, c.created_at, c.updated_at
      FROM public.cards c
     WHERE c.id = p_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_card_with_sibling_sync(
  UUID, UUID, INT, JSONB, public.layout_type, TEXT[], public.jlpt_level
) TO service_role;


-- ─── 1B. find_similar_cards — drop card_type from RETURNS ─────────────────────
-- The function is LANGUAGE sql (not SECURITY DEFINER) so search_path
-- stays unset to keep the pgvector <=> operator visible.

DROP FUNCTION public.find_similar_cards(UUID, UUID, INT);

CREATE FUNCTION public.find_similar_cards(
  p_card_id UUID,
  p_user_id UUID,
  p_limit   INT DEFAULT 10
)
RETURNS TABLE (
  id          UUID,
  deck_id     UUID,
  layout_type public.layout_type,
  fields_data JSONB,
  tags        TEXT[],
  jlpt_level  public.jlpt_level,
  similarity  FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.deck_id,
    c.layout_type,
    c.fields_data,
    c.tags,
    c.jlpt_level,
    1 - (c.embedding <=> src.embedding) AS similarity
  FROM public.cards c
  JOIN public.cards src ON src.id = p_card_id
  WHERE c.user_id       = p_user_id
    AND c.id           != p_card_id
    AND c.embedding     IS NOT NULL
    AND src.embedding   IS NOT NULL
  ORDER BY c.embedding <=> src.embedding
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_cards(UUID, UUID, INT) TO service_role;


-- ─── 1C. get_stale_embedding_cards — drop card_type from RETURNS ──────────────

DROP FUNCTION public.get_stale_embedding_cards(UUID);

CREATE FUNCTION public.get_stale_embedding_cards(p_user_id UUID)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  deck_id         UUID,
  layout_type     public.layout_type,
  fields_data     JSONB,
  parent_card_id  UUID,
  tags            TEXT[],
  jlpt_level      public.jlpt_level,
  state           INT,
  is_suspended    BOOLEAN,
  due             TIMESTAMPTZ,
  stability       FLOAT,
  difficulty      FLOAT,
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
    c.parent_card_id, c.tags, c.jlpt_level,
    c.state, c.is_suspended, c.due, c.stability, c.difficulty,
    c.elapsed_days, c.scheduled_days, c.reps, c.lapses,
    c.last_review, c.created_at, c.updated_at
  FROM public.cards c
  WHERE c.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND c.embedding_updated_at IS NOT NULL
    AND c.embedding_updated_at < c.updated_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_stale_embedding_cards(UUID) TO service_role;


-- ─── 1D. get_due_cards — drop card_type from RETURNS ──────────────────────────

DROP FUNCTION public.get_due_cards(UUID, INT, INT, TEXT);

CREATE FUNCTION public.get_due_cards(
  p_user_id               UUID,
  p_daily_review_limit    INT,
  p_daily_new_cards_limit INT,
  p_timezone              TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  id          UUID,
  deck_id     UUID,
  jlpt_level  public.jlpt_level,
  state       INT,
  due         TIMESTAMPTZ,
  fields_data JSONB,
  layout_type public.layout_type
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH today_bound AS (
    SELECT DATE_TRUNC('day', NOW() AT TIME ZONE p_timezone) AT TIME ZONE p_timezone AS lo
  ),
  counts AS (
    SELECT
      COUNT(*)                                    AS total_today,
      COUNT(*) FILTER (WHERE rl.state_before = 0) AS new_today
    FROM public.review_logs rl, today_bound t
    WHERE rl.user_id = p_user_id
      AND rl.reviewed_at >= t.lo
  ),
  caps AS (
    SELECT
      GREATEST(0, p_daily_review_limit    - total_today)::INT AS remaining_total,
      GREATEST(0, p_daily_new_cards_limit - new_today)::INT   AS remaining_new
    FROM counts
  ),
  overdue AS (
    SELECT
      c.id, c.deck_id, c.jlpt_level,
      c.state, c.due, c.fields_data, c.layout_type,
      0 AS sort_bucket
    FROM public.cards c, caps
    WHERE c.user_id      = p_user_id
      AND c.state        IN (1, 2, 3)
      AND c.is_suspended = FALSE
      AND c.due         <= NOW()
      AND caps.remaining_total > 0
    ORDER BY c.due ASC
    LIMIT (SELECT remaining_total FROM caps)
  ),
  new_slots AS (
    SELECT
      GREATEST(
        0,
        LEAST(
          (SELECT remaining_new FROM caps),
          (SELECT remaining_total FROM caps) - (SELECT COUNT(*)::INT FROM overdue)
        )
      ) AS n
  ),
  news AS (
    SELECT
      c.id, c.deck_id, c.jlpt_level,
      c.state, c.due, c.fields_data, c.layout_type,
      1 AS sort_bucket
    FROM public.cards c, new_slots
    WHERE c.user_id      = p_user_id
      AND c.state        = 0
      AND c.is_suspended = FALSE
      AND new_slots.n > 0
    ORDER BY c.created_at ASC
    LIMIT (SELECT n FROM new_slots)
  )
  SELECT id, deck_id, jlpt_level, state, due, fields_data, layout_type
  FROM (
    SELECT * FROM overdue
    UNION ALL
    SELECT * FROM news
  ) ordered
  ORDER BY sort_bucket, due NULLS FIRST, id;
$$;

GRANT EXECUTE ON FUNCTION public.get_due_cards(UUID, INT, INT, TEXT) TO service_role;


-- ─── 1E. get_problem_cards — drop card_type from RETURNS ──────────────────────

DROP FUNCTION public.get_problem_cards(UUID, TEXT);

CREATE FUNCTION public.get_problem_cards(
  p_user_id UUID,
  p_bucket  TEXT
)
RETURNS TABLE (
  card_id     UUID,
  deck_id     UUID,
  layout_type public.layout_type,
  jlpt_level  public.jlpt_level,
  fields_data JSONB,
  state       INT,
  lapses      INT,
  reps        INT,
  due         TIMESTAMPTZ,
  last_review TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lo INT;
  v_hi INT;
BEGIN
  IF p_bucket = '2-3' THEN
    v_lo := 2; v_hi := 3;
  ELSIF p_bucket = '4-5' THEN
    v_lo := 4; v_hi := 5;
  ELSIF p_bucket = '6-7' THEN
    v_lo := 6; v_hi := 7;
  ELSIF p_bucket = '8plus' THEN
    v_lo := 8; v_hi := NULL;
  ELSE
    RAISE EXCEPTION 'invalid_problem_card_bucket' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    c.id          AS card_id,
    c.deck_id     AS deck_id,
    c.layout_type AS layout_type,
    c.jlpt_level  AS jlpt_level,
    c.fields_data AS fields_data,
    c.state       AS state,
    c.lapses      AS lapses,
    c.reps        AS reps,
    c.due         AS due,
    c.last_review AS last_review
  FROM public.cards c
  WHERE c.user_id      = p_user_id
    AND c.is_suspended = FALSE
    AND c.lapses       >= v_lo
    AND (v_hi IS NULL OR c.lapses <= v_hi)
  ORDER BY c.last_review DESC NULLS LAST, c.id DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_problem_cards(UUID, TEXT) TO service_role;


-- ─── 1F. get_accuracy_by_layout → get_accuracy_by_layout_type ────────────────
-- The old function name claimed "by layout" but grouped by card_type
-- (a long-standing misnomer). Rename + re-point to layout_type so
-- consumers fail loudly rather than silently switch meaning.

DROP FUNCTION public.get_accuracy_by_layout(UUID);

CREATE FUNCTION public.get_accuracy_by_layout_type(p_user_id UUID)
RETURNS TABLE(layout_type TEXT, total BIGINT, successful BIGINT)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.layout_type::TEXT                                        AS layout_type,
    COUNT(*)                                                   AS total,
    COUNT(*) FILTER (WHERE rl.rating IN ('good', 'easy'))      AS successful
  FROM public.review_logs rl
  JOIN public.cards c ON c.id = rl.card_id
  WHERE rl.user_id = p_user_id
  GROUP BY c.layout_type
  ORDER BY c.layout_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_accuracy_by_layout_type(UUID) TO service_role;


-- ─── 1G. get_dashboard_data — re-point accuracy sub-select ───────────────────
-- The bundled dashboard RPC builds its `accuracy` array by SELECTing from
-- get_accuracy_by_layout(). With that RPC dropped, the dashboard's body
-- must be rebuilt to call get_accuracy_by_layout_type() and emit the new
-- `layout_type` key (replacing the old `layout` key).

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'heatmap', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'date',      h.date,
         'retention', h.retention,
         'count',     h.count
       ))
       FROM public.get_heatmap_data(p_user_id) AS h),
      '[]'::jsonb
    ),
    'accuracy', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'layout_type', a.layout_type,
         'total',       a.total,
         'successful',  a.successful
       ))
       FROM public.get_accuracy_by_layout_type(p_user_id) AS a),
      '[]'::jsonb
    ),
    'jlpt_gap', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'jlpt_level', g.jlpt_level,
         'total',      g.total,
         'learned',    g.learned,
         'due',        g.due
       ))
       FROM public.get_jlpt_gap(p_user_id) AS g),
      '[]'::jsonb
    ),
    'milestones', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'jlpt_level',                m.jlpt_level,
         'total',                     m.total,
         'learned',                   m.learned,
         'daily_pace',                m.daily_pace,
         'days_remaining',            m.days_remaining,
         'projected_completion_date', m.projected_completion_date
       ))
       FROM public.get_milestone_forecast(p_user_id) AS m),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_data(UUID) TO service_role;


-- ─── 2. copy_premade_deck — drop card_type from the INSERT ────────────────────
-- Function signature is unchanged; CREATE OR REPLACE is safe.

CREATE OR REPLACE FUNCTION public.copy_premade_deck(
  p_user_id        UUID,
  p_premade_deck_id UUID
)
RETURNS TABLE (deck_id UUID, card_count INT)
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
      layout_type, fields_data, jlpt_level, tags,
      due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps,
      reps, lapses, state, last_review,
      embedding, embedding_updated_at
    )
    SELECT
      p_user_id, v_new_deck_id, NULL,
      c.layout_type, c.fields_data, c.jlpt_level, COALESCE(c.tags, '{}'),
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

GRANT EXECUTE ON FUNCTION public.copy_premade_deck(UUID, UUID) TO service_role;


-- ─── 3. Drop the column ──────────────────────────────────────────────────────

ALTER TABLE public.cards DROP COLUMN card_type;


-- ─── 4. Drop the enum ────────────────────────────────────────────────────────

DROP TYPE public.card_type;
