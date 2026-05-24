-- =============================================================
-- Migration: 20260701000000_maturity_snapshot_suspended_count.sql
--
-- Adds a `suspended_count` to the maturity-pipeline snapshot pipeline so the
-- Statistics page's maturity-flow bar can render its "Suspended" segment from
-- live data instead of a hardcoded 0.
--
-- The original Stage 9 design (20260610000000_card_state_snapshots.sql)
-- deliberately excluded suspended cards from every pipeline bucket — they are
-- not "in the pipeline." That remains true for the four pipeline buckets and
-- for the Progress page's stacked-area chart (which ignores suspended). But
-- the flow bar visualises the *full collection* split, including the paused
-- tail, so it needs the suspended population alongside the pipeline counts.
--
-- Three changes, all additive:
--   1. `card_state_snapshots.suspended_count` column (DEFAULT 0). Historical
--      rows predate it and read 0 — acceptable, since the flow bar consumes
--      today's live row, not the archive.
--   2. `record_card_state_snapshots()` populates it on each cron upsert.
--   3. `get_maturity_pipeline_history()` returns it: historical rows from the
--      column, today's row computed live from the cards table.
-- =============================================================


-- ─── 1. Snapshot column ──────────────────────────────────────────────────────

ALTER TABLE public.card_state_snapshots
  ADD COLUMN IF NOT EXISTS suspended_count INT NOT NULL DEFAULT 0;


-- ─── 2. Recording function ───────────────────────────────────────────────────
--
-- The original joined only non-suspended cards (`AND c.is_suspended = FALSE`).
-- To count suspended cards too, the join now spans all of the user's cards and
-- each pipeline bucket carries the `is_suspended = FALSE` predicate in its
-- FILTER. `suspended_count` is the complementary `is_suspended = TRUE` tally.
-- Return type is unchanged (VOID), so CREATE OR REPLACE keeps the existing
-- service_role grant.

CREATE OR REPLACE FUNCTION public.record_card_state_snapshots()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.card_state_snapshots (
    user_id, snapshot_date,
    new_count, learning_count, review_count, relearning_count, mature_count,
    suspended_count
  )
  SELECT
    p.id,
    (DATE_TRUNC('day', NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::DATE),
    COUNT(c.id) FILTER (WHERE c.is_suspended = FALSE AND c.state = 0)                            ::INT,
    COUNT(c.id) FILTER (WHERE c.is_suspended = FALSE AND c.state = 1)                            ::INT,
    COUNT(c.id) FILTER (WHERE c.is_suspended = FALSE AND c.state = 2 AND c.scheduled_days <  21) ::INT,
    COUNT(c.id) FILTER (WHERE c.is_suspended = FALSE AND c.state = 3)                            ::INT,
    COUNT(c.id) FILTER (WHERE c.is_suspended = FALSE AND c.state = 2 AND c.scheduled_days >= 21) ::INT,
    COUNT(c.id) FILTER (WHERE c.is_suspended = TRUE)                                             ::INT
  FROM public.profiles p
  LEFT JOIN public.cards c
    ON c.user_id = p.id
  GROUP BY p.id, snapshot_date
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    new_count        = EXCLUDED.new_count,
    learning_count   = EXCLUDED.learning_count,
    review_count     = EXCLUDED.review_count,
    relearning_count = EXCLUDED.relearning_count,
    mature_count     = EXCLUDED.mature_count,
    suspended_count  = EXCLUDED.suspended_count,
    recorded_at      = NOW();
END;
$$;

COMMENT ON FUNCTION public.record_card_state_snapshots() IS
  'Backend Completion Plan Stage 9. Upserts one card_state_snapshots row per
   profile per learner-local day, including the suspended-card tally. Runs
   daily via pg_cron. Re-runs are idempotent.';


-- ─── 3. History RPC ──────────────────────────────────────────────────────────
--
-- Adding a column to RETURNS TABLE changes the function's return type, which
-- CREATE OR REPLACE cannot do — DROP then re-CREATE, then re-GRANT.

DROP FUNCTION IF EXISTS public.get_maturity_pipeline_history(UUID, INT);

CREATE FUNCTION public.get_maturity_pipeline_history(
  p_user_id UUID,
  p_days    INT
)
RETURNS TABLE (
  snapshot_date    DATE,
  new_count        INT,
  learning_count   INT,
  review_count     INT,
  relearning_count INT,
  mature_count     INT,
  suspended_count  INT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone TEXT;
  v_today    DATE;
BEGIN
  IF p_days NOT IN (90, 180, 365) THEN
    RAISE EXCEPTION 'invalid_days_parameter' USING ERRCODE = '22023';
  END IF;

  SELECT p.timezone INTO v_timezone FROM public.profiles p WHERE p.id = p_user_id;
  v_timezone := COALESCE(v_timezone, 'UTC');
  v_today    := (DATE_TRUNC('day', NOW() AT TIME ZONE v_timezone)::DATE);

  RETURN QUERY
  WITH historical AS (
    SELECT
      s.snapshot_date,
      s.new_count,
      s.learning_count,
      s.review_count,
      s.relearning_count,
      s.mature_count,
      s.suspended_count
    FROM public.card_state_snapshots s
    WHERE s.user_id       = p_user_id
      AND s.snapshot_date >= v_today - (p_days - 1)
      AND s.snapshot_date <  v_today
  ),
  today AS (
    -- Live counts for the user's "today". Pipeline buckets carry the
    -- non-suspended predicate; suspended_count is the complementary tally.
    SELECT
      v_today AS snapshot_date,
      COUNT(*) FILTER (WHERE c.is_suspended = FALSE AND c.state = 0)                            ::INT AS new_count,
      COUNT(*) FILTER (WHERE c.is_suspended = FALSE AND c.state = 1)                            ::INT AS learning_count,
      COUNT(*) FILTER (WHERE c.is_suspended = FALSE AND c.state = 2 AND c.scheduled_days <  21) ::INT AS review_count,
      COUNT(*) FILTER (WHERE c.is_suspended = FALSE AND c.state = 3)                            ::INT AS relearning_count,
      COUNT(*) FILTER (WHERE c.is_suspended = FALSE AND c.state = 2 AND c.scheduled_days >= 21) ::INT AS mature_count,
      COUNT(*) FILTER (WHERE c.is_suspended = TRUE)                                             ::INT AS suspended_count
    FROM public.cards c
    WHERE c.user_id = p_user_id
  )
  SELECT * FROM historical
  UNION ALL
  SELECT * FROM today
  ORDER BY 1 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_maturity_pipeline_history(UUID, INT) TO service_role;

COMMENT ON FUNCTION public.get_maturity_pipeline_history(UUID, INT) IS
  'Backend Completion Plan Stage 9. Returns the user''s maturity-pipeline
   history for p_days ∈ {90, 180, 365}, including the suspended-card tally.
   Historical rows come from card_state_snapshots; today''s row is always
   computed live from the cards table so the chart reflects the current moment.';
