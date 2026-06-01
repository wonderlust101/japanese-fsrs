-- Migration: day_reflections
--
-- Persists the post-session "day reflection" (the Tomo-voice note on the Review
-- Summary's Session details card) so it becomes a durable row read instead of a
-- Redis-only, regenerate-on-every-cache-miss value. Keyed by (user_id, date_key);
-- the stored `fingerprint` (sha256 of the day's session-id set, computed by
-- day-reflection.service.ts) lets the service detect when the day's work has
-- changed and regenerate, otherwise serve the stored row with zero AI cost.
--
-- Mirrors how weak-spot diagnoses already persist on `weak_spots`: the Express
-- API (service_role) generates and upserts; the client never writes. RLS is
-- defense-in-depth — service_role bypasses it — with a per-user SELECT policy
-- matching the rest of the schema. No INSERT/UPDATE/DELETE policy for
-- `authenticated` (rows are written exclusively by the API, like `profiles`).

CREATE TABLE day_reflections (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ai', 'fallback')),
  fingerprint TEXT NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date_key)
);

ALTER TABLE day_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_reflections: users can read their own reflections"
  ON day_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER day_reflections_updated_at
  BEFORE UPDATE ON day_reflections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Explicit privileges — Supabase's automatic per-table grant machinery does not
-- fire when migrations are applied via `supabase db push` (see
-- 20260511000000_grant_table_privileges.sql). The Express API reads + upserts
-- via service_role; `authenticated` gets SELECT only for defense-in-depth (the
-- client never writes this table; rows are written exclusively by the API).
GRANT SELECT ON public.day_reflections TO authenticated;
GRANT ALL    ON public.day_reflections TO service_role;
