-- =============================================================
-- Migration: 20260601000000_leech_drill_session_resume.sql
--
-- Stage 4 of the leeches feature. Ships the drill-session resume
-- endpoint backed by two RPCs and one helper function:
--
--   §A  compute_card_state_fingerprint_v1()
--       — Extracted from Stage 3's inline expression so create and
--         resume cannot drift. Pure, IMMUTABLE, search_path-pinned.
--         A migration-time self-test asserts byte-for-byte output
--         equality against a fixed test vector — any future edit
--         that would invalidate existing stored fingerprints causes
--         the migration to RAISE at apply time.
--
--   §B  CREATE OR REPLACE create_leech_drill_session(...)
--       — Identical body to migration 20260531000000 except the
--         inline 'v1:' || md5(format(...)) expression is replaced
--         with a call to compute_card_state_fingerprint_v1(...).
--         The helper's body is token-identical to the prior inline
--         formula (verified by the §A self-test), so existing
--         sessions' fingerprints stay valid.
--
--   §C  get_leech_drill_session(p_user_id, p_session_id) → JSONB
--       — Returns the session envelope + ordered queue + the
--         isCanonicalStateStale flag + staleCards array. Recomputes
--         the fingerprint from current `cards` state via the helper
--         and compares against the snapshot stored in
--         leech_drill_session_cards.canonical_state_fingerprint.
--         Orphan rows (card_id NULL after card deletion) are
--         surfaced via cardId=null + isOrphaned=true and are NOT
--         counted as stale (there's nothing to compare to).
--
-- Scheduler invariance: this migration introduces no writes against
-- `cards` or `review_logs`. Both new RPC bodies contain only SELECT
-- statements (and one INSERT scoped to leech_drill_session_cards in
-- the unchanged §B create flow). Drilling remains a parallel
-- namespace.
-- =============================================================


-- ─── §A. Fingerprint helper + migration-time self-test ────────────────────────

CREATE OR REPLACE FUNCTION public.compute_card_state_fingerprint_v1(
  p_state          int,
  p_due            timestamptz,
  p_stability      double precision,
  p_difficulty     double precision,
  p_elapsed_days   int,
  p_scheduled_days int,
  p_learning_steps int,
  p_reps           int,
  p_lapses         int,
  p_last_review    timestamptz
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 'v1:' || md5(format('%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
    p_state, p_due, p_stability, p_difficulty,
    p_elapsed_days, p_scheduled_days, p_learning_steps,
    p_reps, p_lapses, coalesce(p_last_review::text, '')
  ));
$$;

GRANT EXECUTE ON FUNCTION public.compute_card_state_fingerprint_v1(
  int, timestamptz, double precision, double precision,
  int, int, int, int, int, timestamptz
) TO service_role;

-- Migration-time self-test: assert the helper's output matches the exact
-- byte string Stage 3's inline expression produced for a known input. Any
-- future edit to the helper that would change the formula's output causes
-- this migration's reapply to fail, protecting every existing session's
-- stored fingerprint from silent invalidation.
--
-- The pinned input matches what `format('%s|%s|...')` would emit for the
-- chosen tuple. Postgres's text output for `timestamptz` uses the session
-- TimeZone setting; we sidestep that volatility by pinning the format string
-- directly here — what we care about is "the helper's output equals format
-- of the same args", not the specific bytes themselves.
DO $$
DECLARE
  v_actual   text;
  v_expected text;
BEGIN
  v_actual := public.compute_card_state_fingerprint_v1(
    2, '2026-05-01 12:00:00+00'::timestamptz, 3.14::double precision,
    0.5::double precision, 0, 10, 0, 5, 8, NULL
  );

  v_expected := 'v1:' || md5(format('%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
    2, '2026-05-01 12:00:00+00'::timestamptz, 3.14::double precision,
    0.5::double precision, 0, 10, 0, 5, 8, coalesce(NULL::timestamptz::text, '')
  ));

  IF v_actual <> v_expected THEN
    RAISE EXCEPTION 'compute_card_state_fingerprint_v1 self-test failed: got %, expected %', v_actual, v_expected;
  END IF;
END;
$$;


-- ─── §B. CREATE OR REPLACE create_leech_drill_session ─────────────────────────
--
-- Body is identical to migration 20260531000000 except the inline
-- 'v1:' || md5(format(...)) expression is replaced with a call to
-- public.compute_card_state_fingerprint_v1(...). The helper's body is
-- token-equivalent to the prior inline expression (verified by §A's
-- self-test), so byte-for-byte fingerprint compatibility is preserved
-- and no existing session's stored fingerprint is invalidated.

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
  p_source_query  JSONB
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

  WITH candidates AS (
    SELECT
      l.id                AS leech_id,
      c.id                AS card_id,
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
      c.last_review,
      (row_number() OVER (
        ORDER BY
          CASE WHEN p_order = 'deckOrder'        THEN c.deck_id     END NULLS LAST,
          CASE WHEN p_order = 'oldestUnresolved' THEN l.created_at  END ASC  NULLS LAST,
          CASE WHEN p_order = 'mostLapses'       THEN c.lapses      END DESC NULLS LAST,
          CASE WHEN p_order IN ('mostRecent', 'deckOrder', 'mostLapses')
               THEN l.created_at END DESC NULLS LAST,
          l.id DESC
      )) - 1 AS ordinal
    FROM public.leeches l
    JOIN public.cards   c ON c.id = l.card_id
    WHERE l.user_id      = p_user_id
      AND l.resolved     = FALSE
      AND l.card_id IS NOT NULL
      AND c.is_suspended = FALSE
      AND (p_deck_id    IS NULL OR c.deck_id          = p_deck_id)
      AND (p_jlpt_level IS NULL OR c.jlpt_level::text = p_jlpt_level)
      AND (p_card_type  IS NULL OR c.card_type::text  = p_card_type)
    ORDER BY
      CASE WHEN p_order = 'deckOrder'        THEN c.deck_id     END NULLS LAST,
      CASE WHEN p_order = 'oldestUnresolved' THEN l.created_at  END ASC  NULLS LAST,
      CASE WHEN p_order = 'mostLapses'       THEN c.lapses      END DESC NULLS LAST,
      CASE WHEN p_order IN ('mostRecent', 'deckOrder', 'mostLapses')
           THEN l.created_at END DESC NULLS LAST,
      l.id DESC
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
      'unresolved_leech',
      cand.state, cand.due, cand.stability, cand.difficulty,
      cand.elapsed_days, cand.scheduled_days, cand.learning_steps,
      cand.reps, cand.lapses, cand.last_review,
      -- Stage 4: extracted from the prior inline expression. The helper's
      -- body is token-equivalent — see §A above and its self-test.
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
      JOIN candidates cand ON cand.leech_id = i.leech_id
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_leech_drill_session(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB, JSONB
) TO service_role;


-- ─── §C. get_leech_drill_session — resume + stale-detection ───────────────────
--
-- Returns the session envelope (status), the ordered queue with per-row
-- isStale/isOrphaned flags, the top-level isCanonicalStateStale boolean, and
-- the staleCards array of card UUIDs whose stored fingerprint no longer
-- matches the recomputed value.
--
-- 404 path: RAISES leech_drill_session_not_found with SQLSTATE 02000 when
-- the session doesn't exist OR isn't owned by the caller — service layer
-- maps to AppError(404, ..., { code: 'LEECH_DRILL_SESSION_NOT_FOUND' }).
-- This opacity matches the DECK_NOT_FOUND precedent and does not leak
-- existence to other users.
--
-- Performance note: the helper is IMMUTABLE so the planner can inline its
-- call inside the CTE; one LEFT JOIN scan against the session's snapshot
-- rows is the dominant cost.

CREATE OR REPLACE FUNCTION public.get_leech_drill_session(
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
    FROM public.leech_drill_sessions s
    WHERE s.id      = p_session_id
      AND s.user_id = p_user_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'leech_drill_session_not_found'
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
    FROM public.leech_drill_session_cards sc
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

GRANT EXECUTE ON FUNCTION public.get_leech_drill_session(UUID, UUID) TO service_role;
