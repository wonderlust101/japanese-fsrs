-- =============================================================
-- Migration: 20260531000000_leech_drill_sessions.sql
--
-- Stage 3 of the leeches feature (see docs/Add Leeches List and
-- Drill Support.md). Adds the drill-session persistence layer so
-- learners can request a focused practice queue with a frozen
-- snapshot of each card's FSRS state at session start.
--
-- Scope of this migration:
--   • TABLE  leech_drill_sessions       — session envelope (status, source,
--                                          mode, repeat_policy, stop_rule)
--   • TABLE  leech_drill_session_cards  — per-card snapshot + ordinal +
--                                          canonical_state_fingerprint
--   • RPC    create_leech_drill_session — SECURITY DEFINER, transactional
--
-- Out of scope (lands in later stages):
--   • leech_drill_attempts            — Stage 5
--   • leech_drill_card_states         — deferred aggregate
--
-- Scheduler invariance: this migration introduces no triggers and no
-- functions that mutate `cards` or `review_logs`. The RPC's body
-- contains zero UPDATE/DELETE statements against canonical tables —
-- drill is a parallel namespace, never a hidden review.
-- =============================================================


-- ─── §A. leech_drill_sessions ─────────────────────────────────────────────────

CREATE TABLE public.leech_drill_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Source enum admits all five spec values for forward-compatibility; the
  -- application layer (Stage 3) only writes 'unresolved_leeches' and
  -- 'deck_scoped'. Later stages can begin emitting the rest without a
  -- CHECK-rewrite migration.
  source        TEXT        NOT NULL CHECK (source IN (
                              'unresolved_leeches',
                              'high_lapse_candidates',
                              'deck_scoped',
                              'manual_selection',
                              'current_card'
                            )),

  -- Frozen parsed filters at session start. Snake_case so the JSONB matches
  -- DB conventions; analytics later can answer "which decks drive drilling?".
  source_query  JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Reserved fields for Stage 4+ (timed mode, stop rules). Persisted but not
  -- exercised by Stage 3.
  mode          TEXT        NOT NULL DEFAULT 'practice'
                              CHECK (mode IN ('practice', 'timed')),
  repeat_policy TEXT        NOT NULL DEFAULT 'missed_after_lag'
                              CHECK (repeat_policy IN ('none', 'missed_after_lag')),
  stop_rule     JSONB       NOT NULL DEFAULT '{}'::jsonb,

  status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'finished', 'aborted')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leech_drill_sessions_source_query_object
    CHECK (jsonb_typeof(source_query) = 'object'),
  CONSTRAINT leech_drill_sessions_stop_rule_object
    CHECK (jsonb_typeof(stop_rule) = 'object'),
  CONSTRAINT leech_drill_sessions_finished_at_valid
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX leech_drill_sessions_user_created_idx
  ON public.leech_drill_sessions (user_id, created_at DESC, id DESC);

-- Partial index supports "find this user's active session" queries the
-- Stage 4 resume endpoint will use; rows in finished/aborted state are
-- excluded so the index stays narrow.
CREATE INDEX leech_drill_sessions_user_active_idx
  ON public.leech_drill_sessions (user_id, updated_at DESC, id DESC)
  WHERE status = 'active';

ALTER TABLE public.leech_drill_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leech_drill_sessions: users can read their own"
  ON public.leech_drill_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Defense-in-depth INSERT/UPDATE policies. Production writes go via the
-- SECURITY DEFINER RPC under service_role, which bypasses RLS — these are
-- here so a future direct-from-client write path (if any) cannot mint
-- sessions for other users.
CREATE POLICY "leech_drill_sessions: users can insert their own"
  ON public.leech_drill_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leech_drill_sessions: users can update their own"
  ON public.leech_drill_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy — sessions are historical learning data and should not
-- be deleted by normal user actions. Cascade from profiles handles account
-- deletion.


-- ─── §B. leech_drill_session_cards ────────────────────────────────────────────

CREATE TABLE public.leech_drill_session_cards (
  id           UUID NOT NULL DEFAULT gen_random_uuid(),

  session_id   UUID NOT NULL REFERENCES public.leech_drill_sessions(id) ON DELETE CASCADE,

  -- Nullable so session history stays inspectable after card deletion.
  -- Stage 5's attempts reference this row, not `cards` directly.
  card_id      UUID REFERENCES public.cards(id) ON DELETE SET NULL,

  leech_id     UUID REFERENCES public.leeches(id) ON DELETE SET NULL,

  -- Denormalized user_id keeps user-scoped queries and RLS simple. The
  -- session_id already implies ownership but joining through it adds cost.
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  ordinal      INT  NOT NULL CHECK (ordinal >= 0),

  source_reason TEXT NOT NULL CHECK (source_reason IN (
                                'unresolved_leech',
                                'high_lapse_candidate',
                                'manual_selection',
                                'current_card'
                              )),

  -- ─── Canonical scheduler snapshot at session start ───
  -- All ten fields are required (except baseline_last_review, mirroring
  -- cards.last_review nullability). Stage 4's staleness check compares these
  -- to current `cards` state; Stage 5's invariance suite proves they stay
  -- untouched across drill attempts.
  baseline_state            INT          NOT NULL CHECK (baseline_state BETWEEN 0 AND 3),
  baseline_due              TIMESTAMPTZ  NOT NULL,
  baseline_stability        DOUBLE PRECISION NOT NULL CHECK (baseline_stability       >= 0),
  baseline_difficulty       DOUBLE PRECISION NOT NULL CHECK (baseline_difficulty      >= 0),
  baseline_elapsed_days     INT          NOT NULL CHECK (baseline_elapsed_days        >= 0),
  baseline_scheduled_days   INT          NOT NULL CHECK (baseline_scheduled_days      >= 0),
  baseline_learning_steps   INT          NOT NULL CHECK (baseline_learning_steps      >= 0),
  baseline_reps             INT          NOT NULL CHECK (baseline_reps                >= 0),
  baseline_lapses           INT          NOT NULL CHECK (baseline_lapses              >= 0),
  baseline_last_review      TIMESTAMPTZ,

  -- Version-prefixed md5 hash of the ten baseline_* fields. The 'v1:' prefix
  -- lets Stage 4 detect future hash-function changes cleanly: a stored
  -- fingerprint with a different version prefix is treated as stale by
  -- definition until a backfill migration rewrites it.
  canonical_state_fingerprint TEXT NOT NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Primary key is `id` so individual rows can be addressed by UUID alone.
  PRIMARY KEY (id),

  -- Stable insertion order within a session.
  UNIQUE (session_id, ordinal),

  -- ★ Composite unique for Stage 5's anti-fraud FK. Stage 5's
  --   leech_drill_attempts will declare
  --     FOREIGN KEY (session_card_id, session_id)
  --     REFERENCES leech_drill_session_cards (id, session_id)
  --   which makes it structurally impossible for an attempt to reference a
  --   session-card from a different session.
  UNIQUE (id, session_id)
);

CREATE INDEX leech_drill_session_cards_user_card_idx
  ON public.leech_drill_session_cards (user_id, card_id)
  WHERE card_id IS NOT NULL;

-- Prevents the same card appearing twice in one session's queue. Partial
-- so orphan rows (card_id NULL after card deletion) are allowed to coexist.
CREATE UNIQUE INDEX leech_drill_session_cards_session_card_idx
  ON public.leech_drill_session_cards (session_id, card_id)
  WHERE card_id IS NOT NULL;

CREATE INDEX leech_drill_session_cards_leech_idx
  ON public.leech_drill_session_cards (leech_id)
  WHERE leech_id IS NOT NULL;

ALTER TABLE public.leech_drill_session_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leech_drill_session_cards: users can read their own"
  ON public.leech_drill_session_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "leech_drill_session_cards: users can insert their own"
  ON public.leech_drill_session_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies — snapshots are immutable by design.


-- ─── §C. RPC create_leech_drill_session ───────────────────────────────────────
--
-- One transactional entry point for "build me a drill queue." Selects
-- candidates, inserts the session row, inserts N snapshot rows, and returns
-- a JSONB envelope shaped to match ApiLeechDrillSessionSchema on the wire.
--
-- SECURITY DEFINER with pinned search_path matches the precedent in
-- 20260528000000_update_rpcs_return_row.sql:75 and the CLAUDE.md backend
-- standards. GRANT EXECUTE TO service_role at the bottom is mandatory.
--
-- The function performs the candidate selection's ORDER BY using a series
-- of CASE expressions, each gated on the requested sort mode. Sort keys not
-- selected by the current mode evaluate to NULL and are NULLS-LAST sorted,
-- making them no-ops without dynamic SQL.

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
  -- 1. Insert the session envelope.
  INSERT INTO public.leech_drill_sessions (
    user_id, source, source_query, mode, repeat_policy, stop_rule
  ) VALUES (
    p_user_id, p_source, p_source_query, p_mode, p_repeat_policy, p_stop_rule
  )
  RETURNING id INTO v_session_id;

  -- 2. Build the candidate queue and snapshot in one statement. The
  --    candidates CTE is reused by both the INSERT and the final SELECT so
  --    we don't re-join `cards` to fetch fields_data / layout_type / etc.
  WITH candidates AS (
    SELECT
      l.id          AS leech_id,
      c.id          AS card_id,
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
          -- deckOrder: primary key is cards.deck_id ascending. UUID order is
          -- deterministic but not alphabetical — acceptable trade per the
          -- list endpoint's deckOrder precedent.
          CASE WHEN p_order = 'deckOrder'        THEN c.deck_id     END NULLS LAST,
          -- oldestUnresolved: ascending by leech detection time.
          CASE WHEN p_order = 'oldestUnresolved' THEN l.created_at  END ASC  NULLS LAST,
          -- mostLapses: descending by lapse count (then by recency).
          CASE WHEN p_order = 'mostLapses'       THEN c.lapses      END DESC NULLS LAST,
          -- All three remaining sorts use created_at DESC as the next key.
          CASE WHEN p_order IN ('mostRecent', 'deckOrder', 'mostLapses')
               THEN l.created_at END DESC NULLS LAST,
          -- Final tiebreaker — stable across concurrent leech inserts.
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
      'unresolved_leech',  -- Stage 3's only source_reason; Stage 4+ may emit others.
      cand.state, cand.due, cand.stability, cand.difficulty,
      cand.elapsed_days, cand.scheduled_days, cand.learning_steps,
      cand.reps, cand.lapses, cand.last_review,
      -- v1 fingerprint: md5 over the ten canonical fields, pipe-separated.
      -- Stage 4 staleness compares this against the same hash computed from
      -- current `cards` state. The 'v1:' prefix lets future hash bumps
      -- detect stored values written under older schemes.
      'v1:' || md5(format('%s|%s|%s|%s|%s|%s|%s|%s|%s|%s',
        cand.state,
        cand.due,
        cand.stability,
        cand.difficulty,
        cand.elapsed_days,
        cand.scheduled_days,
        cand.learning_steps,
        cand.reps,
        cand.lapses,
        coalesce(cand.last_review::text, '')
      ))
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
