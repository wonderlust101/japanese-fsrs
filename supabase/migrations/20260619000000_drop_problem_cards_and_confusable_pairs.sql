-- =============================================================
-- Migration: 20260619000000_drop_problem_cards_and_confusable_pairs.sql
--
-- Retires two insights surfaces that shipped without a frontend
-- consumer and have been removed from application code in the
-- same PR:
--
--   GET /api/v1/insights/problem-cards   (Stage 7, 20260608)
--   GET /api/v1/insights/confusable-pairs (Stage 10, 20260611)
--
-- This migration drops the database objects each Stage created.
-- The original migration files stay in place as historical record
-- per the forward-only policy in CLAUDE.md.
--
-- Drop order: cron schedule → reader/detection functions → table
-- (CASCADE handles the partial index + RLS policy attached to it).
-- =============================================================


-- ─── pg_cron schedule (defensive) ───────────────────────────────────────────
--
-- Wrapped in DO so the migration applies cleanly on projects where pg_cron
-- isn't enabled (mirrors the guard used by the original Stage 10 migration).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_extension
    WHERE  extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule('record_confusable_pairs_daily');
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    -- pg_cron isn't installed; nothing to unschedule.
    NULL;
  WHEN OTHERS THEN
    -- The schedule may not exist (e.g. the original migration was applied
    -- on an environment that skipped its `cron.schedule` call).
    NULL;
END
$$;


-- ─── Reader / detection functions ───────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_confusable_pairs(UUID, INT);
DROP FUNCTION IF EXISTS public.record_confusable_pairs();
DROP FUNCTION IF EXISTS public.get_problem_cards(UUID, TEXT);


-- ─── confusable_pairs table (CASCADE drops the index + RLS policy) ──────────

DROP TABLE IF EXISTS public.confusable_pairs CASCADE;
