-- =============================================================
-- Migration: 20260504000011_security_documentation_comments.sql
-- Severity: LOW
--
-- Documents intentional policy absences and design decisions
-- so future developers do not mistake omissions for oversights.
-- =============================================================

COMMENT ON TABLE public.profiles IS
  'User profile data. Rows are created exclusively by the handle_new_user()
   trigger (SECURITY DEFINER) on auth.users INSERT. The RLS INSERT policy
   WITH CHECK (false) blocks direct insertion by all roles — users cannot
   create their own profiles; service_role callers must use the trigger
   path. Deletion cascades from auth.users ON DELETE CASCADE; no RLS DELETE
   policy is provided or needed.';

COMMENT ON TABLE public.review_logs IS
  'Append-only audit log of all review events. No UPDATE or DELETE RLS
   policy is intentional — historical review records must never be mutated
   or removed by users. This preserves the FSRS algorithm state space and
   enables audit trails, rollback operations, and analytics. Administrative
   corrections require service_role access.';

COMMENT ON TABLE public.leeches IS
  'Leech records are resolved via the resolved BOOLEAN / resolved_at
   TIMESTAMPTZ columns (which the RLS UPDATE policy allows users to toggle).
   No RLS DELETE policy is intentional — leech records are append-only to
   preserve FSRS historical data. The ''un-leech'' UX is implemented by
   setting resolved = true; the record remains for audit purposes.';

COMMENT ON TABLE public.grammar_pattern_vocabulary IS
  'Junction table linking grammar_patterns to related vocabulary cards.
   No UPDATE policy is intentional: rows are inserted or deleted to replace
   the vocabulary association set, never mutated in place. This prevents
   silent data drift (e.g., changing a card_id without audit).';

COMMENT ON POLICY "premade_decks: authenticated read for active decks"
  ON public.premade_decks IS
  'Intentionally restricts to authenticated role. Anon/unauthenticated
   users cannot browse premade deck metadata. Individual cards within
   decks are readable by authenticated users without requiring subscription
   (free preview); the cards SELECT RLS policy allows user_id IS NULL reads.';
