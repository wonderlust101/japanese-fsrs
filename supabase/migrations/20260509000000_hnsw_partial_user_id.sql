-- =============================================================
-- Migration: 20260509000000_hnsw_partial_user_id.sql
-- Severity: LOW — incremental cleanup
--
-- The HNSW embedding index from 20260504000008 indexes every row,
-- including premade source cards (user_id IS NULL). Those source
-- rows are never returned by find_similar_cards, which always
-- filters WHERE c.user_id = p_user_id. Adding WHERE user_id IS NOT
-- NULL to the index excludes them and shrinks the index slightly
-- (currently ~80 premade rows, more as the seed deck grows).
--
-- Caveats:
-- * Similarity search returns no results between the DROP and the
--   CREATE (typically sub-second at current scale). If you need
--   zero-downtime in the future, switch to a "create new with a
--   different name → drop old → rename" pattern.
-- * find_similar_cards' WHERE c.user_id = p_user_id is a non-null
--   equality, so the partial predicate doesn't change which queries
--   the planner can answer with the index.
-- =============================================================

DROP INDEX cards_embedding_idx;

CREATE INDEX cards_embedding_idx
  ON cards USING hnsw (embedding vector_cosine_ops)
  WHERE user_id IS NOT NULL;
