-- 20260704000000_regrant_similar_and_stale_embedding_execute.sql
--
-- Restore service_role EXECUTE on two functions whose grants were silently
-- dropped by 20260630000004_drop_cards_tags_feature.sql.
--
-- Root cause: that migration used `DROP FUNCTION` + `CREATE` (rather than the
-- `CREATE OR REPLACE` used for every other RPC in the same file) for
-- find_similar_cards and get_stale_embedding_cards, because their RETURNS
-- TABLE shape changed (the `tags` column was removed). In Postgres, EXECUTE
-- privileges are attached to the function object, so DROP discards them; the
-- subsequent CREATE starts from the default ACL (PUBLIC only, which Supabase
-- revokes), leaving service_role with NO EXECUTE privilege. CREATE OR REPLACE
-- preserves the ACL, which is why the other recreated RPCs in that migration
-- kept their grants.
--
-- Impact:
--   * find_similar_cards — called by card.service.ts (GET
--     /api/v1/cards/:id/similar) through the service-role client. Without this
--     grant the call fails with SQLSTATE 42501 (permission denied for
--     function). This is a live, user-facing breakage.
--   * get_stale_embedding_cards — no live caller today, but it is the
--     documented recovery path for cards whose post-create embedding backfill
--     failed. Its grant is restored for symmetry so the path works if wired.
--
-- Signatures are taken verbatim from 20260630000004 (lines 285 and 320).
-- GRANT is idempotent, so this migration is safe to re-run / replay.

GRANT EXECUTE ON FUNCTION public.find_similar_cards(UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_stale_embedding_cards(UUID) TO service_role;
