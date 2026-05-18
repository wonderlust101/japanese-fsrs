-- =============================================================
-- Migration: 20260611000000_confusable_pairs.sql
--
-- Backend Completion Plan Stage 10 — confusable-items detection.
-- Powers `GET /api/v1/insights/confusable-pairs`, which feeds the
-- (currently-deferred) ConfusablePairList component.
--
-- Algorithm:
--
--   1. user_mistakes: every review_logs row with rating ∈ ('again',
--      'hard'), `session_id IS NOT NULL`, and `card_id IS NOT NULL`
--      (the latter to defend against the cards-table SET-NULL
--      cascade preserving review_logs after card deletion).
--   2. session_pairs: self-join user_mistakes on `(user_id, session_id)`
--      with `a.card_id < b.card_id` so each unordered pair surfaces
--      exactly once. The card-id LESS-THAN guard plus the canonical
--      `(card_a, card_b)` PK on confusable_pairs makes the whole
--      pipeline idempotent — replaying detection over the same
--      history yields the same rows.
--   3. pair_counts: GROUP BY user, card_a, card_b, count distinct
--      sessions, filter `HAVING miss_count >= MISS_COUNT_THRESHOLD`.
--   4. Filter by cosine similarity ≥ SIMILARITY_THRESHOLD using the
--      pgvector `<=>` operator on `cards.embedding`. Cards without
--      embeddings are excluded.
--   5. UPSERT into confusable_pairs with `ON CONFLICT DO UPDATE` so
--      re-runs refresh `miss_count`, `similarity_score`, and
--      `last_observed`.
--
-- Threshold notes:
--
--   MISS_COUNT_THRESHOLD = 2
--     The user must have mis-rated both cards in at least two
--     distinct sessions. A single co-mis-rate is noise (one bad
--     day, one tired session); two is the minimum signal.
--
--   SIMILARITY_THRESHOLD = 0.70
--     Cosine similarity (1 - cosine_distance) on the 1536-dim
--     text-embedding-3-small embeddings. Empirically, Japanese
--     vocabulary that learners confuse (来る/入る, 大きい/多い)
--     lands above 0.70 on this scale; unrelated pairs are well
--     below. Tunable — the plan flags this as risk territory.
--
-- pgvector + HNSW note:
--
--   The existing partial HNSW index `cards_embedding_idx` (from
--   migration 20260509000000) is tuned for ORDER BY embedding <=>
--   query_vector LIMIT k — the nearest-neighbour query shape used
--   by find_similar_cards. The detection query below evaluates
--   `ca.embedding <=> cb.embedding` in a WHERE predicate over a
--   small candidate set (mistakes co-occurring in sessions); HNSW
--   does not assist that query shape and the planner will not use
--   it. That is correct behaviour, not a missing-index issue. The
--   candidate set is already bounded by review_logs filters, so
--   per-row distance computation is cheap.
--
-- Per Stage 9, the cron schedule is wrapped in a defensive DO
-- block so the migration applies cleanly on projects where
-- pg_cron has not been enabled yet. Without the cron the
-- detection table simply stops growing — the RPC still works
-- against whatever rows are present.
-- =============================================================


-- ─── 1. confusable_pairs table ──────────────────────────────────────────────

CREATE TABLE public.confusable_pairs (
  user_id          UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Canonical pair ordering: card_a < card_b. The CHECK + composite PK
  -- enforce that every unordered pair {A, B} has exactly one row.
  card_a           UUID         NOT NULL REFERENCES public.cards(id)    ON DELETE CASCADE,
  card_b           UUID         NOT NULL REFERENCES public.cards(id)    ON DELETE CASCADE,
  miss_count       INT          NOT NULL DEFAULT 0,
  similarity_score FLOAT        NOT NULL,
  last_observed    TIMESTAMPTZ  NOT NULL,
  recorded_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, card_a, card_b),
  CHECK (card_a < card_b)
);

-- Hot read path: top N confusable pairs for a user, ordered by miss_count
-- DESC then similarity_score DESC. The PK's leading user_id slice gets us
-- to the user; this composite index serves the ORDER BY directly.
CREATE INDEX confusable_pairs_user_order_idx
  ON public.confusable_pairs (user_id, miss_count DESC, similarity_score DESC);

ALTER TABLE public.confusable_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confusable_pairs: users can read their own pairs"
  ON public.confusable_pairs
  FOR SELECT
  USING (auth.uid() = user_id);


-- ─── 2. Detection function ──────────────────────────────────────────────────

CREATE FUNCTION public.record_confusable_pairs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.confusable_pairs (
    user_id, card_a, card_b, miss_count, similarity_score, last_observed
  )
  WITH user_mistakes AS (
    SELECT
      rl.user_id,
      rl.session_id,
      rl.card_id,
      rl.reviewed_at
    FROM public.review_logs rl
    WHERE rl.rating IN ('again', 'hard')
      AND rl.card_id    IS NOT NULL
      AND rl.session_id IS NOT NULL
  ),
  session_pairs AS (
    -- Self-join: every unordered pair of mis-rated cards in the same
    -- session, for the same user. The `a.card_id < b.card_id` guard
    -- ensures each pair surfaces exactly once and matches the table's
    -- CHECK constraint.
    SELECT
      a.user_id,
      a.card_id  AS card_a,
      b.card_id  AS card_b,
      a.session_id,
      GREATEST(a.reviewed_at, b.reviewed_at) AS last_observed
    FROM user_mistakes a
    JOIN user_mistakes b
      ON a.user_id    = b.user_id
     AND a.session_id = b.session_id
     AND a.card_id    < b.card_id
  ),
  pair_counts AS (
    SELECT
      user_id,
      card_a,
      card_b,
      COUNT(DISTINCT session_id)::INT AS miss_count,
      MAX(last_observed)              AS last_observed
    FROM session_pairs
    GROUP BY user_id, card_a, card_b
    -- MISS_COUNT_THRESHOLD = 2.
    HAVING COUNT(DISTINCT session_id) >= 2
  )
  SELECT
    pc.user_id,
    pc.card_a,
    pc.card_b,
    pc.miss_count,
    -- pgvector cosine distance ∈ [0, 2]; cosine similarity ∈ [-1, 1].
    -- For text embeddings in practice the similarity stays in [0, 1].
    (1 - (ca.embedding <=> cb.embedding))::FLOAT AS similarity_score,
    pc.last_observed
  FROM pair_counts pc
  JOIN public.cards ca
    ON ca.id      = pc.card_a
   AND ca.user_id = pc.user_id
   AND ca.embedding IS NOT NULL
  JOIN public.cards cb
    ON cb.id      = pc.card_b
   AND cb.user_id = pc.user_id
   AND cb.embedding IS NOT NULL
  -- SIMILARITY_THRESHOLD = 0.70.
  WHERE (1 - (ca.embedding <=> cb.embedding)) >= 0.70
  ON CONFLICT (user_id, card_a, card_b) DO UPDATE SET
    miss_count       = EXCLUDED.miss_count,
    similarity_score = EXCLUDED.similarity_score,
    last_observed    = EXCLUDED.last_observed,
    recorded_at      = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_confusable_pairs() TO service_role;

COMMENT ON FUNCTION public.record_confusable_pairs() IS
  'Backend Completion Plan Stage 10. Detects card pairs the user has
   mis-rated in the same session AND that are semantically similar
   (cosine ≥ 0.70). Upserts into confusable_pairs. Idempotent via PK +
   CHECK (card_a < card_b). Runs daily via pg_cron.';


-- ─── 3. Reader RPC ──────────────────────────────────────────────────────────
--
-- Returns top p_limit pairs for the user ordered by (miss_count DESC,
-- similarity_score DESC). Joins both card sides so the consumer can
-- render display fields without a follow-up batch fetch.

CREATE FUNCTION public.get_confusable_pairs(
  p_user_id UUID,
  p_limit   INT
)
RETURNS TABLE (
  card_a_id        UUID,
  card_b_id        UUID,
  card_a_word      TEXT,
  card_a_reading   TEXT,
  card_a_meaning   TEXT,
  card_b_word      TEXT,
  card_b_reading   TEXT,
  card_b_meaning   TEXT,
  miss_count       INT,
  similarity_score FLOAT,
  last_observed    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.card_a,
    cp.card_b,
    ca.fields_data ->> 'word'    AS card_a_word,
    ca.fields_data ->> 'reading' AS card_a_reading,
    ca.fields_data ->> 'meaning' AS card_a_meaning,
    cb.fields_data ->> 'word'    AS card_b_word,
    cb.fields_data ->> 'reading' AS card_b_reading,
    cb.fields_data ->> 'meaning' AS card_b_meaning,
    cp.miss_count,
    cp.similarity_score,
    cp.last_observed
  FROM public.confusable_pairs cp
  JOIN public.cards ca ON ca.id = cp.card_a
  JOIN public.cards cb ON cb.id = cp.card_b
  WHERE cp.user_id = p_user_id
  ORDER BY cp.miss_count DESC, cp.similarity_score DESC, cp.card_a, cp.card_b
  LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_confusable_pairs(UUID, INT) TO service_role;

COMMENT ON FUNCTION public.get_confusable_pairs(UUID, INT) IS
  'Backend Completion Plan Stage 10. Returns the top p_limit (capped to
   100) confusable pairs for the user, ordered by miss_count DESC then
   similarity_score DESC.';


-- ─── 4. Daily cron schedule (defensive) ─────────────────────────────────────
--
-- Same pattern as Stage 9's maturity snapshots — wrapped in a DO block so
-- the migration applies cleanly on projects without pg_cron. Without the
-- cron, the table never accumulates rows but the RPC + table still work
-- against any manual `SELECT record_confusable_pairs()` invocations.

DO $cron_schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 03:00 UTC every day. Offset from Stage 9's 02:15 UTC snapshot job
    -- so the two crons do not compete for connection slots on the
    -- shared service-role connection pool.
    PERFORM cron.schedule(
      'record_confusable_pairs_daily',
      '0 3 * * *',
      $job$SELECT public.record_confusable_pairs();$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not present; skipping record_confusable_pairs_daily schedule. Enable pg_cron in the Supabase dashboard and re-run this DO block (or add a follow-up migration) to start the daily detection job.';
  END IF;
END;
$cron_schedule$;
