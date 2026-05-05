-- ============================================================
-- Migration: 20260511000000_grant_table_privileges.sql
--
-- Root cause: supabase db push applies migrations as raw SQL.
-- Supabase's automatic per-table grant machinery (which fires when
-- tables are created via the dashboard) does not run. As a result
-- service_role (and authenticated / anon) lack explicit privileges
-- on all application tables, causing 42501 on any non-SELECT
-- operation from the server-side supabaseAdmin client.
--
-- Fix: grant the minimum required privilege set on every
-- application table to each Supabase role.
--   service_role  → ALL  (bypasses RLS; used by Express API)
--   authenticated → ALL CRUD ops (RLS policies control row access)
--   anon          → SELECT only on read-only public tables
-- ============================================================


-- ── profiles ────────────────────────────────────────────────
-- No INSERT: the "profiles: no direct insert" RLS policy (20260504000010)
-- enforces trigger-only creation. Granting INSERT here is unnecessary and
-- would be misleading — omitting it makes the intent explicit.
GRANT SELECT, UPDATE                  ON public.profiles         TO authenticated;
GRANT ALL                             ON public.profiles         TO service_role;

-- ── user_interests ───────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_interests    TO authenticated;
GRANT ALL                             ON public.user_interests    TO service_role;

-- ── decks ────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks             TO authenticated;
GRANT ALL                             ON public.decks             TO service_role;

-- ── cards ────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards             TO authenticated;
GRANT ALL                             ON public.cards             TO service_role;

-- ── review_logs ──────────────────────────────────────────────
GRANT SELECT, INSERT                  ON public.review_logs       TO authenticated;
GRANT ALL                             ON public.review_logs       TO service_role;

-- ── leeches ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE          ON public.leeches           TO authenticated;
GRANT ALL                             ON public.leeches           TO service_role;

-- ── grammar_patterns ─────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grammar_patterns   TO authenticated;
GRANT ALL                             ON public.grammar_patterns   TO service_role;

-- ── grammar_pattern_vocabulary ───────────────────────────────
GRANT SELECT, INSERT, DELETE          ON public.grammar_pattern_vocabulary TO authenticated;
GRANT ALL                             ON public.grammar_pattern_vocabulary TO service_role;

-- ── premade_decks ─────────────────────────────────────────────
GRANT SELECT                          ON public.premade_decks     TO anon, authenticated;
GRANT ALL                             ON public.premade_decks     TO service_role;

-- ── user_premade_subscriptions ───────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_premade_subscriptions TO authenticated;
GRANT ALL                             ON public.user_premade_subscriptions TO service_role;
