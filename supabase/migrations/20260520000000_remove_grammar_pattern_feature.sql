-- =============================================================
-- Migration: 20260520000000_remove_grammar_pattern_feature.sql
--
-- Removes the unused grammar_patterns table and the JLPT N5–N1 Grammar
-- premade deck. The feature was introduced in 20260425000001 but never
-- wired up to any service-layer code; verified via grep across apps/,
-- packages/, and SQL function bodies.
--
--   A. Backfill user-fork decks: any fork of the JLPT Grammar premade
--      inherited deck_type='grammar' at fork time. The cascade in
--      Section B sets source_premade_id = NULL but leaves deck_type
--      untouched, so we update them now to 'vocabulary' before the
--      enum recreate in Section D would otherwise abort.
--
--   B. Delete the JLPT Grammar premade deck. Cascades:
--        cards.premade_deck_id ON DELETE CASCADE         → seed cards
--        user_premade_subscriptions  ON DELETE CASCADE   → subscriptions
--        decks.source_premade_id     ON DELETE SET NULL  → forks survive
--      User forks keep their cards (intentional per the cascade design
--      from migration 20260519000000's COMMENT on premade_decks.is_active).
--
--   C. DROP TABLE grammar_patterns. Auto-removes its 2 indexes,
--      7 CHECK constraints, 4 RLS policies, and the
--      grammar_patterns_updated_at trigger. No FK references it
--      (grammar_pattern_vocabulary was dropped in 20260514000000).
--
--   D. Recreate the deck_type enum without 'grammar'. Postgres has no
--      DROP VALUE; uses the rename-then-recreate pattern from
--      20260502000004's card_type migration. After Section A no row
--      holds 'grammar', so the USING is trivial.
--
-- The layout_type='grammar' enum value is intentionally NOT dropped
-- here — it was used by the now-deleted seed cards but no code
-- references it as a literal. Dropping it would be its own enum
-- recreate operation; defer.
-- =============================================================


-- ─── A. Backfill user-fork deck_types ─────────────────────────────────────────

UPDATE decks
SET deck_type = 'vocabulary'
WHERE deck_type = 'grammar';


-- ─── B. Delete the JLPT N5–N1 Grammar premade deck ───────────────────────────
-- The seed UUID is stable across environments (defined in 20260504000000).
-- Cascades from cards.premade_deck_id and user_premade_subscriptions fire
-- automatically. decks.source_premade_id SET NULL preserves user forks.

DELETE FROM premade_decks
WHERE id = '22222222-2222-4222-8222-000000000001';


-- ─── C. Drop the grammar_patterns table ──────────────────────────────────────

DROP TABLE grammar_patterns;


-- ─── D. Recreate the deck_type enum without 'grammar' ────────────────────────

ALTER TYPE deck_type RENAME TO deck_type_old;

CREATE TYPE deck_type AS ENUM ('vocabulary', 'kanji', 'mixed');

ALTER TABLE premade_decks
  ALTER COLUMN deck_type DROP DEFAULT,
  ALTER COLUMN deck_type TYPE deck_type
    USING (deck_type::text::deck_type);

ALTER TABLE decks
  ALTER COLUMN deck_type DROP DEFAULT,
  ALTER COLUMN deck_type TYPE deck_type
    USING (deck_type::text::deck_type);

ALTER TABLE decks ALTER COLUMN deck_type SET DEFAULT 'vocabulary';

DROP TYPE deck_type_old;
