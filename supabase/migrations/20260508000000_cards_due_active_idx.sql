-- =============================================================
-- Migration: 20260508000000_cards_due_active_idx.sql
-- Severity: HIGH — hot-path performance
--
-- getDueCards() in apps/api/src/services/review.service.ts filters
-- on (user_id, state IN (Learning|Review|Relearning), is_suspended,
-- due) and orders by due. The existing cards_user_id_due_idx
-- (user_id, due) covers user_id+due but cannot satisfy the state
-- and is_suspended predicates, so the planner reads matching rows
-- from the heap and filters in memory. For users with thousands of
-- cards this becomes the dominant cost in the review-queue load.
--
-- This partial index aligns the leading columns to the actual
-- predicate (user_id, state, due) and prunes suspended rows via
-- the partial WHERE. The is_suspended = FALSE filter typically
-- excludes 95%+ of suspended cards from the index, keeping it
-- compact and making it directly usable as an index-only scan
-- for the LIMIT 200 review-queue path.
--
-- Migration 20260504000002 created an analogous index on the old
-- `status` column, but that column was dropped in 20260504000004
-- (replaced by `state` + `is_suspended`). This migration is the
-- post-restructure replacement.
-- =============================================================

CREATE INDEX cards_due_active_idx
  ON cards (user_id, state, due)
  WHERE is_suspended = FALSE;
