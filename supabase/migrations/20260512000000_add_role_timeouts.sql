-- ── service_role timeout limits ─────────────────────────────────────────────
-- statement_timeout caps individual query execution; lock_timeout caps how long
-- a session waits for a row/table lock before bailing. Both apply to API calls
-- via the service-role connection (it bypasses RLS but inherits these limits).
-- Sized to compose under the 10s supabase-js fetch timeout in db/supabase.ts;
-- see apps/api/src/lib/timeouts.ts for the full budget composition.
--
-- Idempotent at the role level — re-running this migration is a no-op.
ALTER ROLE service_role SET statement_timeout = '10s';
ALTER ROLE service_role SET lock_timeout      = '2s';
