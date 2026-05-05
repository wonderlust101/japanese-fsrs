-- ============================================================
-- Migration: 20260506000002_embedding_updated_at.sql
-- Add embedding_updated_at column to track embedding staleness
-- ============================================================

-- Tracks when the embedding was last regenerated.
-- NULL = no embedding has been generated yet.
-- When embedding_updated_at < updated_at, the embedding is stale
-- (content changed after embedding was computed).

ALTER TABLE cards ADD COLUMN embedding_updated_at TIMESTAMPTZ;

-- Backfill: mark existing embeddings as updated at card creation time.
-- Cards with no embedding (embedding IS NULL) get NULL timestamp.
UPDATE cards SET embedding_updated_at = created_at WHERE embedding IS NOT NULL;
