-- =============================================================
-- Migration: 20260707000000_fix_record_snapshots_group_by.sql
--
-- Fixes a latent bug in record_card_state_snapshots() that has existed since
-- the original Stage 9 migration (20260610000000) and survived the
-- suspended_count rewrite (20260701000000): the aggregate query ends with
--
--     GROUP BY p.id, snapshot_date
--
-- but `snapshot_date` is the INSERT *target* column, not a column of the FROM
-- tables (profiles p LEFT JOIN cards c), and the SELECT's date expression was
-- never aliased AS snapshot_date. PostgreSQL resolves GROUP BY names against
-- the source relations + SELECT aliases, finds `snapshot_date` only on the
-- target table, and raises:
--
--     42703: column "snapshot_date" ... cannot be referenced from this part
--            of the query
--
-- So every invocation errored — the daily pg_cron snapshot has never recorded
-- a row, leaving card_state_snapshots empty (the maturity-history chart only
-- ever showed its live "today" column). The integration test for the RPC is
-- the first caller to exercise it directly, which surfaced this.
--
-- Fix: GROUP BY p.id alone. p.id is the profiles primary key, so p.timezone
-- (and the date expression derived from it) is functionally dependent and may
-- appear in the SELECT without being grouped — one output row per profile,
-- carrying that profile's learner-local day. Behaviour is otherwise identical
-- to 20260701000000; only the GROUP BY clause changes. RETURNS VOID is
-- unchanged, so CREATE OR REPLACE preserves the existing service_role grant.
-- =============================================================

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
  -- p.id is the profiles PK ⇒ the timezone-derived snapshot_date expression is
  -- functionally dependent and needs no explicit grouping. (The previous
  -- `, snapshot_date` referenced the INSERT target column and raised 42703.)
  GROUP BY p.id
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
