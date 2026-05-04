-- ============================================================
-- Hygiene fixes from the DBA audit (L1, L2).
--
-- L1. Add SET search_path to set_updated_at() to satisfy the Supabase
--     SECURITY-lint warning about mutable search_path. The function is
--     invoker-rights so the practical risk is low, but the lint will
--     complain forever otherwise.
--
-- L2. Replace the IVFFlat embedding index with HNSW. HNSW is generally
--     better for read-heavy workloads (better recall at the same speed)
--     and removes the `lists` build-time tuning knob that IVFFlat needs
--     to be re-chosen as the dataset grows.
-- ============================================================


-- ─── L1. set_updated_at() — pin search_path ──────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ─── L2. cards_embedding_idx: IVFFlat → HNSW ─────────────────────────────────
DROP INDEX IF EXISTS cards_embedding_idx;
CREATE INDEX cards_embedding_idx
  ON cards USING hnsw (embedding vector_cosine_ops);
