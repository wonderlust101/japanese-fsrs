-- =============================================================
-- Migration: 20260513000000_validation_hardening.sql
--
-- Forward-only fixes for findings from the migration audit:
--
--   A. M6 — profiles_timezone_iana regex was too strict; it rejected
--      valid IANA names that contain digits (Etc/GMT+8, Etc/GMT-12,
--      Etc/GMT+0). Loosen to allow digits in the second character class.
--
--   B. M7 — profiles_native_language_iso639 regex only accepted bare
--      ISO 639-1 ± a 2-letter region (en, en-US). Expand to BCP-47-ish:
--      also accept ISO 639-3 (eng), and script subtags (zh-Hans, sr-Latn).
--      Constraint name kept for stability; the comment documents the
--      broader scope.
--
--   C. C1 — grammar_pattern_vocabulary junction is unused by every API
--      service (verified: only the auto-generated Supabase types
--      reference it). Drop it cleanly. Future replays of the original
--      C1 backfill in 20260504000004 cannot fail on FK orphans because
--      the table no longer exists.
--
--   D. cards_fields_data_shape invariant self-test. The CHECK was
--      added in 20260504000007 (M3). Any future replay against a DB
--      restored from the window between 20260502000004 (which dropped
--      the typed content columns into fields_data='{}') and
--      20260504000007 (which added the CHECK) would fail mid-chain.
--      This DO block runs the same predicate up-front so the failure
--      is loud and clearly remediation-pointed instead of leaving the
--      schema half-applied.
--
-- All CHECK reapplies use NOT VALID + VALIDATE so the constraint is
-- registered cheaply; validation is a separate ALTER that doesn't
-- block writes against unrelated columns.
-- =============================================================


-- ─── A. profiles.timezone — accept Etc/GMT±N ─────────────────────────────────

ALTER TABLE profiles DROP CONSTRAINT profiles_timezone_iana;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_timezone_iana
  CHECK (
    timezone = 'UTC'
    OR timezone ~ '^[A-Za-z]+(/[A-Za-z0-9_+\-]+)+$'
  )
  NOT VALID;

ALTER TABLE profiles VALIDATE CONSTRAINT profiles_timezone_iana;

COMMENT ON CONSTRAINT profiles_timezone_iana ON profiles IS
  'IANA timezone format check. Accepts UTC and any Region/Subregion[/Subregion...]
   identifier built from letters, digits, underscore, plus, minus. Permits
   Etc/GMT+8, Etc/GMT-12, America/Argentina/Buenos_Aires, etc. Membership in
   pg_timezone_names cannot be expressed in a CHECK because that view is STABLE,
   not IMMUTABLE — format validation is the most we can enforce here.';


-- ─── B. profiles.native_language — accept BCP-47 with script subtag ──────────

ALTER TABLE profiles DROP CONSTRAINT profiles_native_language_iso639;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_native_language_iso639
  CHECK (
    native_language ~ '^[a-z]{2,3}(-([A-Z]{2}|[A-Z][a-z]{3}))?$'
  )
  NOT VALID;

ALTER TABLE profiles VALIDATE CONSTRAINT profiles_native_language_iso639;

COMMENT ON CONSTRAINT profiles_native_language_iso639 ON profiles IS
  'Language tag format check. Accepts ISO 639-1 (en) and 639-3 (eng) primary
   tags, optionally followed by a 2-letter region (en-US) or 4-letter script
   subtag (zh-Hans, sr-Latn). Constraint name retained from 20260504000007
   to avoid a rename; scope is now broader than ISO 639-1.';


-- ─── C. drop unused grammar_pattern_vocabulary junction ──────────────────────
-- The junction was introduced in 20260504000004 (C1) to replace the
-- grammar_patterns.linked_vocabulary UUID[] column. No service in
-- apps/api/src ever inserts into or reads from it; only the auto-generated
-- Supabase types reference the table. Dropping it removes the future-replay
-- FK risk that the original C1 backfill carried (orphan UUIDs from the array
-- would have aborted the INSERT … unnest pattern).

DROP TABLE IF EXISTS grammar_pattern_vocabulary;


-- ─── D. cards_fields_data_shape invariant self-test ──────────────────────────
-- No-op on healthy DBs. Loud failure if a future replay restored data from
-- the 20260502000004 → 20260504000007 window (when fields_data='{}' was
-- legal but no backfill carried the typed content columns into it).

DO $$
DECLARE
  v_violations INT;
BEGIN
  SELECT COUNT(*) INTO v_violations
  FROM cards
  WHERE NOT (
    (
      layout_type IN ('vocabulary', 'grammar')
      AND fields_data ? 'word'
      AND fields_data ? 'reading'
      AND fields_data ? 'meaning'
    )
    OR (
      layout_type = 'sentence'
      AND fields_data <> '{}'::jsonb
    )
  );

  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'cards_fields_data_shape invariant violated by % row(s). Backfill fields_data from the legacy content columns before re-applying this migration chain.',
      v_violations;
  END IF;
END;
$$;
