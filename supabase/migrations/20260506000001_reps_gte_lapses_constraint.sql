-- ============================================================
-- Migration: 20260506000001_reps_gte_lapses_constraint.sql
-- Add CHECK constraint: lapses <= reps (logical invariant)
-- ============================================================

-- Constraint: User cannot have more lapses than total reviews attempted.
-- Enforces FSRS invariant: lapses is a subset of reps.

ALTER TABLE cards ADD CONSTRAINT cards_lapses_lte_reps CHECK (lapses <= reps);
ALTER TABLE grammar_patterns ADD CONSTRAINT grammar_patterns_lapses_lte_reps CHECK (lapses <= reps);
