-- =============================================================
-- Migration: 20260610000000_card_state_snapshots.sql
--
-- Backend Completion Plan Stage 9 — per-day maturity snapshots.
-- Powers `GET /api/v1/insights/maturity-history?days=90|180|365`,
-- which feeds the Progress page's stacked-area maturity-pipeline
-- chart.
--
-- The chart needs N days of per-state counts per user. Rebuilding
-- the history from `review_logs` on every page load was the
-- alternative we rejected — it would burn CPU and grow with
-- history length. Instead:
--
--   1. A snapshot table holds one row per (user, day) carrying the
--      per-state card counts at the moment the cron ran for that
--      user's local day.
--   2. A SECURITY DEFINER cron job rolls all users daily and upserts
--      their current counts.
--   3. The history RPC reads `snapshot_date < user_today` from the
--      table and computes `user_today` live from the cards table.
--      That way the chart always reflects the current moment for
--      today, even between cron runs, and the table only carries
--      "settled" past days.
--
-- Today's row from the snapshot table (if any) is intentionally
-- ignored by the RPC — the live computation is always more accurate
-- than the cron's last snapshot of "today".
--
-- The cron schedule is wrapped in a defensive DO block so the
-- migration applies cleanly even on a project where pg_cron has
-- not been enabled yet. The application works without the cron —
-- only the historical archive stops growing. An operator can
-- enable pg_cron in the Supabase dashboard later and re-run this
-- migration's schedule statement by hand (or add a follow-up
-- migration).
-- =============================================================


-- ─── 1. Snapshot table ──────────────────────────────────────────────────────
--
-- The five count columns split the FSRS card_state integer space the way the
-- Progress chart visualises it:
--   new_count        — state = 0 (FSRS New)
--   learning_count   — state = 1 (FSRS Learning)
--   review_count     — state = 2 AND scheduled_days < 21 (post-graduation,
--                      pre-mature; matches the Anki convention)
--   relearning_count — state = 3 (FSRS Relearning)
--   mature_count     — state = 2 AND scheduled_days >= 21 (Anki mature;
--                      same predicate Stage 3's list_decks_paginated uses)
--
-- Suspended cards are excluded from every bucket — they're not "in the
-- pipeline" any more than a deleted card would be.

CREATE TABLE public.card_state_snapshots (
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_date    DATE NOT NULL,
  new_count        INT  NOT NULL DEFAULT 0,
  learning_count   INT  NOT NULL DEFAULT 0,
  review_count     INT  NOT NULL DEFAULT 0,
  relearning_count INT  NOT NULL DEFAULT 0,
  mature_count     INT  NOT NULL DEFAULT 0,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, snapshot_date)
);

-- The PK is (user_id, snapshot_date); range scans by user across a window of
-- dates use that PK directly. No additional indexes needed for the RPC's
-- typical query shape (`WHERE user_id = ? AND snapshot_date BETWEEN ? AND ?`).

ALTER TABLE public.card_state_snapshots ENABLE ROW LEVEL SECURITY;

-- Read-only RLS — the snapshot rows are populated by the SECURITY DEFINER
-- cron function (which bypasses RLS by design). End users read their own
-- snapshots via the API; direct PostgREST reads would land here.
CREATE POLICY "card_state_snapshots: users can read their own snapshots"
  ON public.card_state_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);


-- ─── 2. Snapshot-recording function ─────────────────────────────────────────
--
-- One INSERT statement iterating all profiles, computing each user's local
-- date from their `profiles.timezone`, joining their non-suspended cards
-- with FILTER aggregates per FSRS state. ON CONFLICT DO UPDATE so re-running
-- intraday refreshes the row with current counts.
--
-- `LEFT JOIN` on cards so a user with zero cards still gets a snapshot row
-- with zeroes — the chart shouldn't show a gap just because the learner
-- hasn't created any cards yet.

CREATE FUNCTION public.record_card_state_snapshots()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.card_state_snapshots (
    user_id, snapshot_date,
    new_count, learning_count, review_count, relearning_count, mature_count
  )
  SELECT
    p.id,
    (DATE_TRUNC('day', NOW() AT TIME ZONE COALESCE(p.timezone, 'UTC'))::DATE),
    COUNT(c.id) FILTER (WHERE c.state = 0)                                              ::INT,
    COUNT(c.id) FILTER (WHERE c.state = 1)                                              ::INT,
    COUNT(c.id) FILTER (WHERE c.state = 2 AND c.scheduled_days <  21)                   ::INT,
    COUNT(c.id) FILTER (WHERE c.state = 3)                                              ::INT,
    COUNT(c.id) FILTER (WHERE c.state = 2 AND c.scheduled_days >= 21)                   ::INT
  FROM public.profiles p
  LEFT JOIN public.cards c
    ON c.user_id = p.id AND c.is_suspended = FALSE
  GROUP BY p.id, snapshot_date
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    new_count        = EXCLUDED.new_count,
    learning_count   = EXCLUDED.learning_count,
    review_count     = EXCLUDED.review_count,
    relearning_count = EXCLUDED.relearning_count,
    mature_count     = EXCLUDED.mature_count,
    recorded_at      = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_card_state_snapshots() TO service_role;

COMMENT ON FUNCTION public.record_card_state_snapshots() IS
  'Backend Completion Plan Stage 9. Upserts one card_state_snapshots row per
   profile per learner-local day. Runs daily via pg_cron. Re-runs are
   idempotent — ON CONFLICT DO UPDATE refreshes the row''s counts.';


-- ─── 3. History RPC ─────────────────────────────────────────────────────────
--
-- Returns up to `p_days` rows ordered by snapshot_date ASC. Historical rows
-- come from the snapshot table; today's row is always computed live so the
-- chart reflects the user's current state between cron runs.

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
  mature_count     INT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone TEXT;
  v_today    DATE;
BEGIN
  -- Validate p_days. The plan specifies three discrete windows; reject
  -- anything else with a recognisable SQLSTATE so the service layer can map
  -- cleanly to HTTP 400. (The controller's Zod layer rejects unknown values
  -- first; this is defence in depth for direct-SQL callers.)
  IF p_days NOT IN (90, 180, 365) THEN
    RAISE EXCEPTION 'invalid_days_parameter' USING ERRCODE = '22023';
  END IF;

  -- Resolve the learner's timezone for the "today" boundary. The fallback
  -- to UTC is defensive — profiles.timezone is NOT NULL DEFAULT 'UTC'.
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
      s.mature_count
    FROM public.card_state_snapshots s
    WHERE s.user_id       = p_user_id
      AND s.snapshot_date >= v_today - (p_days - 1)
      AND s.snapshot_date <  v_today
  ),
  today AS (
    -- Live counts for the user's "today" in their local timezone. Computed
    -- on every request so the chart reflects the current moment even
    -- between cron runs. The cron's "today" row (if any) is intentionally
    -- not read above.
    SELECT
      v_today AS snapshot_date,
      COUNT(*) FILTER (WHERE c.state = 0)                                ::INT AS new_count,
      COUNT(*) FILTER (WHERE c.state = 1)                                ::INT AS learning_count,
      COUNT(*) FILTER (WHERE c.state = 2 AND c.scheduled_days <  21)     ::INT AS review_count,
      COUNT(*) FILTER (WHERE c.state = 3)                                ::INT AS relearning_count,
      COUNT(*) FILTER (WHERE c.state = 2 AND c.scheduled_days >= 21)     ::INT AS mature_count
    FROM public.cards c
    WHERE c.user_id      = p_user_id
      AND c.is_suspended = FALSE
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
   history for p_days ∈ {90, 180, 365}. Historical rows come from
   card_state_snapshots; today''s row is always computed live from the
   cards table so the chart reflects the current moment.';


-- ─── 4. Daily cron schedule (defensive) ─────────────────────────────────────
--
-- Wrapped in a DO block so the migration applies cleanly on projects where
-- pg_cron has not yet been enabled. The table + functions above are created
-- unconditionally — the application works without the cron (the RPC's
-- "today" row is always live; only the historical archive stops growing).
-- An operator can enable pg_cron in the Supabase dashboard later and either
-- re-run this DO block by hand or land a follow-up migration to schedule.

DO $cron_schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 02:15 UTC every day. Low-traffic hour across most timezones; the
    -- per-user date label is computed from profiles.timezone inside the
    -- function so an over-the-midnight-line shift only affects which
    -- date label is written, not whether the row gets written.
    PERFORM cron.schedule(
      'record_card_state_snapshots_daily',
      '15 2 * * *',
      $job$SELECT public.record_card_state_snapshots();$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not present; skipping record_card_state_snapshots_daily schedule. Enable pg_cron in the Supabase dashboard and re-run this DO block (or add a follow-up migration) to start the daily snapshot job.';
  END IF;
END;
$cron_schedule$;
