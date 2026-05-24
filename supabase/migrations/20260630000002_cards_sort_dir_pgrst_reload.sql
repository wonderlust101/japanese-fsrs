-- =============================================================
-- Migration: force PostgREST schema reload + drop orphan overload
-- Date:     2026-06-30
--
-- Two cleanups for the cards sort-direction work in 20260630000001:
--
-- 1. Drop the orphan 9-param `list_cards_cross_deck` overload that
--    survived the presence-filters migration. Postgres allows
--    multiple function signatures with the same name; PostgREST will
--    sometimes match an older overload when the named-arg set doesn't
--    uniquely identify the new one, producing puzzling "function
--    found but query returns no rows" symptoms. Cleaning the orphan
--    leaves only the 12-param version we actually want callers to
--    hit.
--
-- 2. NOTIFY PostgREST to reload its schema cache so the new
--    `p_sort_dir` parameter is recognized immediately. Without this,
--    calls that include `p_sort_dir` may be silently routed to an
--    older overload (or rejected) until PostgREST's cache TTL elapses
--    or the service restarts.
-- =============================================================

DROP FUNCTION IF EXISTS public.list_cards_cross_deck(
  UUID, INT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
);

NOTIFY pgrst, 'reload schema';
