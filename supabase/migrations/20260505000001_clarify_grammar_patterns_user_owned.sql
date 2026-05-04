-- ============================================================
-- Migration: 20260505000001_clarify_grammar_patterns_user_owned.sql
-- Severity: LOW (documentation + constraint)
--
-- Context:
--   The grammar_patterns table has user_id that can be NULL (for premade
--   source patterns, mirroring the cards.user_id = NULL design). However,
--   deck_id is NOT NULL and references decks(user_id), which means
--   premade grammar patterns CANNOT exist in practice — they would need
--   a deck_id pointing to some user's deck.
--
--   No seeding of premade grammar patterns exists. In production, all
--   grammar_patterns rows have user_id != NULL.
--
-- Action:
--   Add a CHECK constraint to explicitly document that grammar patterns
--   are always user-owned. This clarifies the design intent at the DB layer
--   and prevents accidental rows with user_id = NULL.
--
-- Impact:
--   - Zero impact on existing data (all rows already have user_id != NULL)
--   - Prevents future confusion about premade grammar pattern support
--   - Explicit design documentation via SQL constraint
-- ============================================================

ALTER TABLE grammar_patterns
  ADD CONSTRAINT grammar_patterns_user_owned
    CHECK (user_id IS NOT NULL);

-- Documentation comment explaining the design
COMMENT ON CONSTRAINT grammar_patterns_user_owned ON grammar_patterns IS
  'Grammar patterns are always user-owned. Premade source patterns are out of
   scope for this schema design. The deck_id NOT NULL reference (which requires
   a user_id via the decks table) and user_id NOT NULL constraint together
   enforce this pattern. If premade grammar patterns are added in future,
   revise this constraint and create a system-owned deck to parent them.';
