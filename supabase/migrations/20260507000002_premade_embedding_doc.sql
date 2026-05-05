-- =============================================================
-- Migration: 20260507000002_premade_embedding_doc.sql
-- Severity: LOW (documentation only)
--
-- The 20260504000000 seed migration does not populate embedding for
-- premade source cards (NULL on insert). Embeddings cannot be
-- computed in SQL — they require an OpenAI API call from the
-- service layer. This comment documents the lifecycle so future
-- migrations / DBA reviews don't treat the NULL state as a bug.
--
-- Population paths:
--   1. POST /api/v1/admin/backfill-premade-embeddings (one-shot, ops-triggered)
--   2. createCard() fire-and-forget for user-owned cards
--   3. POST /api/v1/cards/:id/regenerate-embedding (user-triggered)
-- =============================================================

COMMENT ON COLUMN cards.embedding IS
  'Cosine-similarity embedding (text-embedding-3-small, 1536 dims).
   Lazily populated: NULL on initial seed/insert. Set by createCard()
   async backfill, the regenerate-embedding endpoint, the admin
   backfill-premade-embeddings endpoint, or the subscribe_to_premade_deck
   RPC (which copies the source embedding to the user fork).
   find_similar_cards filters embedding IS NOT NULL.';

COMMENT ON COLUMN cards.embedding_updated_at IS
  'Timestamp of the most recent embedding write. NULL means no embedding
   has been generated yet. Stale when embedding_updated_at < updated_at,
   surfaced by the get_stale_embedding_cards RPC for re-embedding.';
