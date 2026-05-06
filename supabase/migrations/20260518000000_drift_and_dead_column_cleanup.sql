-- =============================================================
-- Migration: 20260518000000_drift_and_dead_column_cleanup.sql
--
-- A. grammar_patterns.user_id drift
--    Migration 20260505000001 added a `grammar_patterns_user_owned`
--    CHECK constraint enforcing user_id IS NOT NULL, but the column
--    itself remained nullable. Generated types reflect the column-level
--    declaration, so consumers were carrying defensive null-checks for
--    a value the DB will never accept. Promote to a column-level NOT
--    NULL and drop the now-redundant CHECK.
--
-- B. cards dead-column cleanup
--    • audio_url   — added in 20260425000001 for a planned audio feature.
--    • tokens      — added in 20260502000004 for the morphological-analysis
--                    bridge.
--    • parsed_at   — same migration, same feature.
--
--    Verified via grep: zero references in apps/, packages/, or any
--    other migration. Only mention is a comment in card.service.ts:35
--    documenting their *exclusion* from CARD_COLUMNS. If those features
--    ever ship, the columns can be re-added with dedicated migrations.
-- =============================================================


-- ─── A. grammar_patterns.user_id drift fix ───────────────────────────────────

ALTER TABLE grammar_patterns ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE grammar_patterns DROP CONSTRAINT grammar_patterns_user_owned;


-- ─── B. cards dead-column cleanup ────────────────────────────────────────────

ALTER TABLE cards
  DROP COLUMN IF EXISTS audio_url,
  DROP COLUMN IF EXISTS tokens,
  DROP COLUMN IF EXISTS parsed_at;
