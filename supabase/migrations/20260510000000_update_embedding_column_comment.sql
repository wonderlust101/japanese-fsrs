-- =============================================================
-- Migration: 20260510000000_update_embedding_column_comment.sql
-- Severity: TRIVIAL — documentation update
--
-- The cards.embedding COMMENT ON applied in 20260507000002 listed
-- the (now-removed) admin backfill endpoint as one of the
-- population paths. The endpoint was replaced with an out-of-API
-- Bun script (apps/api/scripts/backfill-premade-embeddings.ts).
-- Refresh the column comment so its documentation matches the
-- actual code paths.
--
-- Comment-only change. Zero effect on data, queries, or planner.
-- =============================================================

COMMENT ON COLUMN cards.embedding IS
  'Cosine-similarity embedding (text-embedding-3-small, 1536 dims).
   Lazily populated: NULL on initial seed/insert. Set by createCard()
   async backfill, the regenerate-embedding endpoint, the
   apps/api/scripts/backfill-premade-embeddings.ts ops script, or the
   subscribe_to_premade_deck RPC (which copies the source embedding
   to the user fork). find_similar_cards filters embedding IS NOT NULL.';
