-- Fix update_deck_with_version_check.
--
-- The function (last defined in 20260528000001) both DECLARED `is_premade_fork`
-- in its RETURNS TABLE and selected `d.is_premade_fork` in its RETURN QUERY.
-- That column was dropped in 20260607000000_premade_copy_model.sql (copy model),
-- and `archived_at` was added in 20260622000000_deck_archive.sql. The RPC was
-- never updated, so every PATCH /api/v1/decks/:id failed with
-- "column d.is_premade_fork does not exist" (SQLSTATE 42703 → HTTP 500).
--
-- Redefine the RPC to the CURRENT decks shape consumed by DeckListRpcRowSchema
-- in apps/api/src/services/deck.service.ts: drop is_premade_fork, add
-- archived_at. The version-check + UPDATE logic is unchanged.

DROP FUNCTION IF EXISTS public.update_deck_with_version_check(UUID, UUID, INT, JSONB);

CREATE FUNCTION public.update_deck_with_version_check(
  p_deck_id          UUID,
  p_user_id          UUID,
  p_expected_version INT,
  p_patch            JSONB
)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  description       TEXT,
  deck_type         public.deck_type,
  source_premade_id UUID,
  card_count        INT,
  version           INT,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_current_version INT;
BEGIN
  SELECT d.version
    INTO v_current_version
    FROM public.decks d
   WHERE d.id = p_deck_id
     AND d.user_id = p_user_id
   FOR UPDATE;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'deck_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified deck does not exist or does not belong to this user.';
  END IF;

  IF v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'deck_version_mismatch'
      USING ERRCODE = '22000',
            HINT    = 'Deck was modified since the version snapshot. Refetch and retry.';
  END IF;

  UPDATE public.decks SET
    name        = COALESCE(p_patch->>'name',                                      name),
    description = COALESCE(p_patch->>'description',                               description),
    deck_type   = COALESCE(NULLIF(p_patch->>'deck_type', '')::public.deck_type,   deck_type),
    is_public   = COALESCE((p_patch->>'is_public')::BOOLEAN,                      is_public),
    version     = version + 1,
    updated_at  = NOW()
  WHERE public.decks.id = p_deck_id
    AND public.decks.user_id = p_user_id;

  RETURN QUERY
    SELECT d.id, d.name, d.description, d.deck_type, d.source_premade_id,
           d.card_count, d.version, d.created_at, d.updated_at, d.archived_at
      FROM public.decks d
     WHERE d.id = p_deck_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_deck_with_version_check(UUID, UUID, INT, JSONB) TO service_role;
