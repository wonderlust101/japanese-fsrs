-- =============================================================
-- Migration: 20260710000000_idempotency_stale_claim_reclaim.sql
--
-- Bounds the "orphaned in-flight idempotency claim" failure mode.
--
-- Before this change, claim_idempotency_key (20260524000000) only ever
-- cleared rows via the 24h expires_at TTL. If a worker claimed a key
-- (inserted a row with response_status IS NULL) and then died before
-- storing its response — deploy, OOM, SIGKILL — the row stayed
-- 'in_flight' and every retry of that exact request got 409 for up to
-- 24 HOURS. The offline-review queue (which reuses one batch
-- Idempotency-Key across retries) surfaced this as a wedged sync.
--
-- Fix: an in-flight row older than a short staleness threshold is
-- provably orphaned and is reclaimed as 'fresh'. The API caps every
-- request at server.requestTimeout = 30s (apps/api/src/index.ts) with a
-- worst-case wall time of ~23s, so NO live worker can hold a claim for
-- 2 minutes — anything older is a dead worker's leftover.
--
-- Trade-off (accepted, "bounded reclaim"): if a worker crashes AFTER its
-- work transaction commits but BEFORE store_idempotency_response runs, a
-- post-threshold retry re-runs the work (e.g. a double review-log +
-- double FSRS advance). That is recoverable via the existing rollback
-- and is far rarer / less harmful than a 24h hard lockout. Eliminating it
-- entirely (atomic claim+work+store in one transaction) is a post-MVP
-- follow-up.
--
-- Forward-only CREATE OR REPLACE: signature and return shape are
-- unchanged, so database.types.ts needs no regeneration. SECURITY DEFINER
-- + SET search_path = '' + fully-qualified public.* refs are preserved.
-- =============================================================

CREATE OR REPLACE FUNCTION claim_idempotency_key(
  p_user_id      UUID,
  p_key          UUID,
  p_request_hash TEXT
)
RETURNS TABLE (
  status        TEXT,
  stored_status INT,
  stored_body   JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted BOOLEAN;
  v_row      public.idempotency_keys%ROWTYPE;
BEGIN
  -- Lazy cleanup of expired rows for this user. Bounded — each user has
  -- at most a handful of open keys at any time.
  DELETE FROM public.idempotency_keys
  WHERE user_id = p_user_id AND expires_at < now();

  -- Atomically claim. ON CONFLICT DO NOTHING + the EXISTS check on the CTE's
  -- RETURNING tells us whether THIS call won the race.
  WITH ins AS (
    INSERT INTO public.idempotency_keys (user_id, key, request_hash)
    VALUES (p_user_id, p_key, p_request_hash)
    ON CONFLICT (user_id, key) DO NOTHING
    RETURNING user_id
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO v_inserted;

  IF v_inserted THEN
    -- Fresh claim — caller proceeds to run the worker.
    RETURN QUERY SELECT 'fresh'::TEXT, NULL::INT, NULL::JSONB;
    RETURN;
  END IF;

  -- Existing row — inspect.
  SELECT * INTO v_row
  FROM public.idempotency_keys
  WHERE user_id = p_user_id AND key = p_key;

  IF v_row.request_hash <> p_request_hash THEN
    RETURN QUERY SELECT 'conflict'::TEXT, NULL::INT, NULL::JSONB;
  ELSIF v_row.response_status IS NULL THEN
    -- In-flight. The reserving worker may have died before storing a
    -- response. The 30s server request cap means no LIVE worker holds a
    -- claim past ~2 minutes, so an older row is provably orphaned. The
    -- conditional UPDATE reclaims it atomically: only the row-lock winner
    -- whose created_at is still stale flips it (resetting created_at so it
    -- now owns a fresh claim window); a concurrent reclaim or a genuinely
    -- live claim affects 0 rows and falls through to 'in_flight'.
    --
    -- The request_hash is guaranteed equal here (the conflict branch above
    -- already handled a mismatch), so there is nothing to rewrite.
    UPDATE public.idempotency_keys
       SET created_at = now()
     WHERE user_id = p_user_id
       AND key     = p_key
       AND created_at < now() - INTERVAL '2 minutes';

    IF FOUND THEN
      RETURN QUERY SELECT 'fresh'::TEXT, NULL::INT, NULL::JSONB;
    ELSE
      RETURN QUERY SELECT 'in_flight'::TEXT, NULL::INT, NULL::JSONB;
    END IF;
  ELSE
    RETURN QUERY SELECT 'replay'::TEXT, v_row.response_status, v_row.response_body;
  END IF;
END;
$$;

-- CREATE OR REPLACE preserves existing grants; re-stated explicitly per the
-- SECURITY DEFINER convention in CLAUDE.md / docs/DATABASE.md.
GRANT EXECUTE ON FUNCTION claim_idempotency_key(UUID, UUID, TEXT) TO service_role;
