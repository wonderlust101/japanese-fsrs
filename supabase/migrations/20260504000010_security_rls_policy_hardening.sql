-- =============================================================
-- Migration: 20260504000010_security_rls_policy_hardening.sql
-- Severity: HIGH / MEDIUM
--
-- Adds missing RLS policies and tightens existing ones to
-- improve defense-in-depth against unauthorized data access.
-- =============================================================

-- -------------------------------------------------------
-- 2a. profiles: block direct INSERT (trigger-only pattern)
-- -------------------------------------------------------
-- Profiles are ONLY created by the handle_new_user() SECURITY DEFINER
-- trigger on auth.users INSERT. No role should be able to directly
-- INSERT a profile row — users cannot create their own, and service
-- roles should use the trigger path. This WITH CHECK (false) policy
-- makes insertion impossible at the RLS layer for all non-definer roles.

CREATE POLICY "profiles: no direct insert"
  ON public.profiles FOR INSERT
  WITH CHECK (false);


-- -------------------------------------------------------
-- 2b. premade_decks: restrict to authenticated role
-- -------------------------------------------------------
-- Closes anon role access to premade deck metadata.
-- Only authenticated users can browse active premade decks.

DROP POLICY IF EXISTS "premade_decks: public read for active decks" ON public.premade_decks;

CREATE POLICY "premade_decks: authenticated read for active decks"
  ON public.premade_decks FOR SELECT
  USING (is_active = TRUE AND auth.role() = 'authenticated');
