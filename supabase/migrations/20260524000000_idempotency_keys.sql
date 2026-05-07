-- =============================================================
-- Migration: 20260524000000_idempotency_keys.sql
--
-- Adds the per-user idempotency-key replay store. Required by
-- POST /api/v1/reviews/submit, /reviews/batch, /decks, and
-- /decks/:deckId/cards (see Track I of the API contract cleanup).
--
-- Storage scope: per-user (PK on user_id, key) so two users can't
-- collide on the same UUID. TTL: 24h, enforced lazily — every
-- claim_idempotency_key call drops expired rows for the calling
-- user before processing. No pg_cron needed at this scale.
--
-- Three SECURITY DEFINER RPCs (service-role only):
--   • claim_idempotency_key  — atomically detect fresh / replay /
--                              conflict / in_flight
--   • store_idempotency_response — write the final status + body
--   • delete_idempotency_key — release a placeholder when the
--                              worker throws a non-AppError exception
--                              (so the caller can retry instead of
--                              hitting in_flight for 24h)
-- =============================================================


-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.idempotency_keys (
  user_id         UUID        NOT NULL,
  key             UUID        NOT NULL,
  request_hash    TEXT        NOT NULL,
  -- NULL while in-flight; populated by store_idempotency_response on completion.
  response_status INT,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  PRIMARY KEY (user_id, key)
);

CREATE INDEX idempotency_keys_expires_at_idx
  ON public.idempotency_keys (expires_at);

-- Service-role only. The replay store is never read or written directly by
-- the user-scoped JWT path; the API service speaks to it via the RPCs below.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;


-- ─── A. claim_idempotency_key ─────────────────────────────────────────────────

CREATE FUNCTION claim_idempotency_key(
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
    -- Another caller claimed first and is still processing.
    RETURN QUERY SELECT 'in_flight'::TEXT, NULL::INT, NULL::JSONB;
  ELSE
    RETURN QUERY SELECT 'replay'::TEXT, v_row.response_status, v_row.response_body;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_idempotency_key(UUID, UUID, TEXT) TO service_role;


-- ─── B. store_idempotency_response ────────────────────────────────────────────

CREATE FUNCTION store_idempotency_response(
  p_user_id UUID,
  p_key     UUID,
  p_status  INT,
  p_body    JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.idempotency_keys
  SET response_status = p_status,
      response_body   = p_body
  WHERE user_id = p_user_id AND key = p_key;
END;
$$;

GRANT EXECUTE ON FUNCTION store_idempotency_response(UUID, UUID, INT, JSONB) TO service_role;


-- ─── C. delete_idempotency_key ────────────────────────────────────────────────

CREATE FUNCTION delete_idempotency_key(
  p_user_id UUID,
  p_key     UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE user_id = p_user_id AND key = p_key;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_idempotency_key(UUID, UUID) TO service_role;
