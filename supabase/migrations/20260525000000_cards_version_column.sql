-- =============================================================
-- Migration: 20260525000000_cards_version_column.sql
--
-- Adds optimistic-concurrency control to PATCH /api/v1/cards/:id.
-- Track J of the API contract / idempotency hardening work.
--
-- Two changes:
--   A. ALTER TABLE cards ADD COLUMN version INT NOT NULL DEFAULT 1.
--      Existing rows pick up version=1; new inserts default to 1; the
--      RPC bumps version on every successful UPDATE. Wire format
--      exposes version on full-card responses (ApiCard); list / due
--      projections intentionally omit it (only the detail view drives
--      PATCH, so only the detail view needs the current version).
--
--   B. update_card_with_sibling_sync gains a required p_expected_version
--      parameter. If the target card's current version doesn't match,
--      the RPC raises 'card_version_mismatch' (SQLSTATE 22000); the
--      service layer maps this to AppError(412, "Card has been modified
--      since you loaded it"). Successful updates increment version on
--      the target AND every sibling touched by the sync, so a stale
--      sibling-edit will also fail-fast.
--
-- DROP+CREATE because PostgreSQL CREATE OR REPLACE FUNCTION cannot
-- change the parameter list. The existing GRANT is re-issued below.
-- =============================================================


-- ─── A. cards.version column ──────────────────────────────────────────────────

ALTER TABLE public.cards
  ADD COLUMN version INT NOT NULL DEFAULT 1;


-- ─── B. update_card_with_sibling_sync — version-aware ─────────────────────────

DROP FUNCTION update_card_with_sibling_sync(
  UUID, UUID, JSONB, public.layout_type, public.card_type, TEXT[], public.jlpt_level
);

CREATE FUNCTION update_card_with_sibling_sync(
  p_card_id          UUID,
  p_user_id          UUID,
  p_expected_version INT,
  p_fields_data      JSONB                DEFAULT NULL,
  p_layout_type      public.layout_type   DEFAULT NULL,
  p_card_type        public.card_type     DEFAULT NULL,
  p_tags             TEXT[]               DEFAULT NULL,
  p_jlpt_level       public.jlpt_level    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_root_id        UUID;
  v_current_version INT;
  v_shared_fields  JSONB := '{}'::jsonb;
BEGIN
  -- Lock the target row + ownership check + version snapshot in one shot.
  -- Premade source cards (user_id IS NULL) are excluded by user_id equality.
  SELECT version
    INTO v_current_version
    FROM public.cards
   WHERE id = p_card_id
     AND user_id = p_user_id
     FOR UPDATE;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'card_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified card does not exist or does not belong to this user.';
  END IF;

  IF v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'card_version_mismatch'
      USING ERRCODE = '22000',
            HINT    = 'Card was modified since the version snapshot. Refetch and retry.';
  END IF;

  -- Apply the patch. COALESCE keeps existing values when a param is NULL,
  -- preserving partial-update semantics from the JS layer.
  UPDATE public.cards SET
    fields_data = COALESCE(p_fields_data, fields_data),
    layout_type = COALESCE(p_layout_type, layout_type),
    card_type   = COALESCE(p_card_type,   card_type),
    tags        = COALESCE(p_tags,        tags),
    jlpt_level  = COALESCE(p_jlpt_level,  jlpt_level),
    version     = version + 1,
    updated_at  = NOW()
  WHERE id = p_card_id
    AND user_id = p_user_id;

  -- Sibling sync only runs when fields_data was actually patched.
  IF p_fields_data IS NOT NULL THEN
    SELECT COALESCE(parent_card_id, id)
      INTO v_root_id
      FROM public.cards
     WHERE id = p_card_id;

    IF p_fields_data ? 'word' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('word', p_fields_data->'word');
    END IF;
    IF p_fields_data ? 'reading' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('reading', p_fields_data->'reading');
    END IF;
    IF p_fields_data ? 'meaning' THEN
      v_shared_fields := v_shared_fields || jsonb_build_object('meaning', p_fields_data->'meaning');
    END IF;

    IF v_shared_fields <> '{}'::jsonb THEN
      UPDATE public.cards
         SET fields_data = fields_data || v_shared_fields,
             version     = version + 1,
             updated_at  = NOW()
       WHERE user_id = p_user_id
         AND id != p_card_id
         AND (parent_card_id = v_root_id OR id = v_root_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_card_with_sibling_sync(
  UUID, UUID, INT, JSONB, public.layout_type, public.card_type, TEXT[], public.jlpt_level
) TO service_role;
