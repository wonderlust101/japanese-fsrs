-- =============================================================
-- Migration: 20260602000000_leech_drill_attempts.sql
--
-- Stage 5 of the leeches feature — the final backend stage. Adds:
--
--   §A  leech_drill_attempts table
--       — Immutable per-answer events. UNIQUE (user_id, event_id)
--         is the DB-level eventId idempotency guarantee.
--         Composite FK (session_card_id, session_id) REFERENCES
--         leech_drill_session_cards (id, session_id) makes
--         cross-session attempt forgery structurally impossible —
--         this is the constraint Stage 3 reserved.
--
--   §B  record_leech_drill_attempt RPC
--       — Reads canonical card_id/leech_id from the session card,
--         checks client-supplied consistency assertions, INSERTs
--         the attempt with ON CONFLICT DO NOTHING for eventId
--         idempotency, and returns the canonical row envelope
--         (either fresh insert or replay).
--
-- Scheduler invariance (the load-bearing structural property of
-- the whole drill feature): this migration introduces no triggers
-- and no functions that mutate `cards` or `review_logs`. The RPC's
-- body contains zero UPDATE/DELETE/INSERT against canonical FSRS
-- tables — it only reads `leech_drill_session_cards` and writes/
-- reads `leech_drill_attempts`. Drilling is, by construction, a
-- parallel SRS namespace.
-- =============================================================


-- ─── §A. leech_drill_attempts ─────────────────────────────────────────────────

CREATE TABLE public.leech_drill_attempts (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Client-generated domain event identifier. The (user_id, event_id) tuple
  -- is the authoritative idempotency key — retrying with the same eventId is
  -- a no-op at the DB layer (ON CONFLICT DO NOTHING in the RPC).
  event_id        UUID NOT NULL,

  session_id      UUID NOT NULL,
  session_card_id UUID NOT NULL,

  -- Nullable so attempt history stays inspectable after underlying
  -- leech/card deletion. Same orphan semantics as leech_drill_session_cards.
  leech_id        UUID REFERENCES public.leeches(id) ON DELETE SET NULL,
  card_id         UUID REFERENCES public.cards(id)   ON DELETE SET NULL,

  -- Denormalized user_id for fast user-scoped queries and RLS predicates
  -- without joining through the session table. Cascades on account delete.
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  result          TEXT NOT NULL CHECK (result IN ('missed', 'hesitated', 'remembered')),

  local_sequence  INT,
  response_time_ms INT,

  shown_at        TIMESTAMPTZ,
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),

  -- ★ DB-enforced eventId idempotency. One row per (user, domain event).
  --   Retrying with the same eventId triggers ON CONFLICT DO NOTHING in the
  --   RPC; the replay path then fetches and returns the existing row.
  UNIQUE (user_id, event_id),

  -- ★ Anti-fraud composite FK consuming Stage 3's reserved UNIQUE (id,
  --   session_id) on leech_drill_session_cards. With this constraint, a
  --   client cannot submit an attempt against a session-card from a
  --   different session — the DB rejects the row before application code
  --   runs. This is structural anti-fraud; no TypeScript check can be
  --   bypassed.
  CONSTRAINT leech_drill_attempts_session_card_fk
    FOREIGN KEY (session_card_id, session_id)
    REFERENCES public.leech_drill_session_cards (id, session_id)
    ON DELETE CASCADE,

  -- Direct FK to the session envelope so attempts cascade on session delete.
  -- Redundant-but-explicit: the composite FK above also covers session
  -- deletes via the session_card row's cascade, but declaring this FK
  -- separately documents the intent at the schema level.
  CONSTRAINT leech_drill_attempts_session_fk
    FOREIGN KEY (session_id) REFERENCES public.leech_drill_sessions(id)
    ON DELETE CASCADE,

  CONSTRAINT leech_drill_attempts_local_sequence_valid
    CHECK (local_sequence IS NULL OR local_sequence >= 0),
  CONSTRAINT leech_drill_attempts_response_time_valid
    CHECK (response_time_ms IS NULL OR response_time_ms >= 0),

  CONSTRAINT leech_drill_attempts_answered_after_shown
    CHECK (shown_at IS NULL OR answered_at >= shown_at)
);

CREATE INDEX leech_drill_attempts_user_created_idx
  ON public.leech_drill_attempts (user_id, created_at DESC, id DESC);

CREATE INDEX leech_drill_attempts_leech_created_idx
  ON public.leech_drill_attempts (leech_id, created_at DESC)
  WHERE leech_id IS NOT NULL;

CREATE INDEX leech_drill_attempts_session_idx
  ON public.leech_drill_attempts (session_id, created_at ASC, id ASC);

CREATE INDEX leech_drill_attempts_session_card_idx
  ON public.leech_drill_attempts (session_card_id, created_at DESC, id DESC);

ALTER TABLE public.leech_drill_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leech_drill_attempts: users can read their own"
  ON public.leech_drill_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "leech_drill_attempts: users can insert their own"
  ON public.leech_drill_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE policies — attempts are append-only by design.


-- ─── §B. record_leech_drill_attempt RPC ───────────────────────────────────────
--
-- Transactional entry point for "record this drill answer." Reads the
-- canonical card_id/leech_id from the session card (the request body's
-- cardId/leechId are downgraded to consistency *assertions* — see the
-- mismatch RAISEs below), then INSERTs the attempt with ON CONFLICT for
-- idempotency, and returns the canonical row envelope.
--
-- Error semantics:
--   - 02000 leech_drill_session_card_not_found  → service maps to 404
--                                                  LEECH_DRILL_SESSION_CARD_NOT_FOUND
--   - 22000 leech_drill_attempt_card_mismatch   → service maps to 422
--                                                  LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH
--   - 22000 leech_drill_attempt_leech_mismatch  → service maps to 422
--                                                  LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH

CREATE OR REPLACE FUNCTION public.record_leech_drill_attempt(
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
    FROM public.leech_drill_session_cards
    WHERE id = p_session_card_id
      AND session_id = p_session_id;

  IF v_session_card_found IS NOT TRUE OR v_session_card_owner IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'leech_drill_session_card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT = 'sessionCardId not found, or sessionId/user mismatch.';
  END IF;

  -- 2. Consistency assertions. The client's body cardId/leechId, when
  --    supplied, MUST match the canonical values on session_cards. This
  --    catches client bugs early rather than letting an attempt log under
  --    a misattributed card.
  IF p_asserted_card_id IS NOT NULL
     AND p_asserted_card_id IS DISTINCT FROM v_canonical_card_id THEN
    RAISE EXCEPTION 'leech_drill_attempt_card_mismatch'
      USING ERRCODE = '22000',
            HINT = 'Body cardId does not match session_card.card_id.';
  END IF;
  IF p_asserted_leech_id IS NOT NULL
     AND p_asserted_leech_id IS DISTINCT FROM v_canonical_leech_id THEN
    RAISE EXCEPTION 'leech_drill_attempt_leech_mismatch'
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
  INSERT INTO public.leech_drill_attempts (
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
      FROM public.leech_drill_attempts
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
    FROM public.leech_drill_attempts a
    WHERE a.id = v_attempt_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_leech_drill_attempt(
  UUID, UUID, UUID, UUID, UUID, UUID, TEXT, INT, INT, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;
