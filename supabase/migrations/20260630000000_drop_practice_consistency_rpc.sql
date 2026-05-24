-- Migration: 20260630000000_drop_practice_consistency_rpc.sql
--
-- The practice-consistency feature (added in migration 20260628000002) was
-- removed from the product. This drops the now-orphaned RPC so the
-- database surface no longer carries a function with no caller.
--
-- Forward-only migration; the corresponding service / controller / route /
-- shared-types / fixtures / UI components were removed in the same PR.

DROP FUNCTION IF EXISTS get_practice_consistency(UUID, TEXT);
