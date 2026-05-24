-- Migration: 20260629000000_drop_session_hesitation_outliers_rpc.sql
--
-- The hesitation-outliers feature (added in migration 20260628000001) was
-- removed from the product. This drops the now-orphaned RPC so the
-- database surface no longer carries a function with no caller.
--
-- Forward-only migration; the corresponding service / controller / route /
-- shared-types / fixtures were removed in the same PR.

DROP FUNCTION IF EXISTS get_session_hesitation_outliers(UUID, UUID);
