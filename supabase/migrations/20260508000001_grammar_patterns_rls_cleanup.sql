-- =============================================================
-- Migration: 20260508000001_grammar_patterns_rls_cleanup.sql
-- Severity: MEDIUM — dead code cleanup
--
-- The original SELECT policy on grammar_patterns (from 20260425000001)
-- permitted reads where user_id = auth.uid() OR user_id IS NULL,
-- mirroring the cards table where premade source rows have
-- user_id = NULL. However, migration 20260505000001 documented and
-- enforced that grammar_patterns are always user-owned via
-- CHECK (user_id IS NOT NULL).
--
-- The OR user_id IS NULL branch is therefore unreachable. Drop and
-- recreate the policy with the simpler condition so the intent is
-- clear at the RLS layer and future readers don't expect premade
-- grammar patterns to be supported.
-- =============================================================

DROP POLICY IF EXISTS "grammar_patterns: users can read their own and premade patterns"
  ON grammar_patterns;

CREATE POLICY "grammar_patterns: users can read their own"
  ON grammar_patterns FOR SELECT
  USING (auth.uid() = user_id);
