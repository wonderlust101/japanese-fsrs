-- =============================================================
-- Migration: 20260509000002_drop_unused_fields_data_gin.sql
-- Severity: LOW — dead-weight index removal
--
-- cards_fields_data_gin_idx was added in 20260504000005 H6 for
-- "future find card by word / containment queries". A grep across
-- apps/api/src and apps/web confirms no service code uses JSONB
-- containment on fields_data — every read goes through the typed
-- service-layer projection, never .contains() / @> / ? / ?| / ?&.
--
-- The index costs disk and adds write amplification on every
-- card insert/update. Drop now; if a future feature needs JSONB
-- containment search, re-add then.
-- =============================================================

DROP INDEX IF EXISTS cards_fields_data_gin_idx;
