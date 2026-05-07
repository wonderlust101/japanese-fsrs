-- =============================================================
-- Migration: 20260526000000_decks_profile_version_columns.sql
--
-- Extends the optimistic-concurrency pattern from cards (migration
-- 20260525000000) to decks and profiles. Closes the silent-clobber
-- window on PATCH /api/v1/decks/:id and PATCH /api/v1/profile when
-- the same user edits from two devices.
--
-- Three changes:
--   A. ALTER TABLE public.decks    ADD COLUMN version INT NOT NULL DEFAULT 1.
--   B. ALTER TABLE public.profiles ADD COLUMN version INT NOT NULL DEFAULT 1.
--   C. update_profile_with_interests gains a required p_expected_version
--      parameter. On mismatch it raises 'profile_version_mismatch' (SQLSTATE
--      22000); the service layer maps to AppError(412). Successful UPDATE
--      bumps version.
--   D. New update_deck_with_version_check RPC mirrors cards: snapshot version
--      under FOR UPDATE, raise 'deck_not_found' (no_data_found) or
--      'deck_version_mismatch' (22000), bump version on success.
--
-- DROP+CREATE for update_profile_with_interests because PostgreSQL
-- CREATE OR REPLACE FUNCTION cannot change the parameter list. The
-- existing GRANT is re-issued under the new signature.
-- =============================================================


-- ─── A. decks.version column ──────────────────────────────────────────────────

ALTER TABLE public.decks
  ADD COLUMN version INT NOT NULL DEFAULT 1;


-- ─── B. profiles.version column ───────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN version INT NOT NULL DEFAULT 1;


-- ─── C. update_profile_with_interests — version-aware ────────────────────────

DROP FUNCTION update_profile_with_interests(UUID, JSONB, TEXT[]);

CREATE FUNCTION update_profile_with_interests(
  p_user_id          UUID,
  p_expected_version INT,
  p_patch            JSONB,
  p_interests        TEXT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_version INT;
BEGIN
  -- Snapshot version + acquire row lock. The empty search_path means custom
  -- types must be schema-qualified (see migration 20260514000001).
  SELECT version
    INTO v_current_version
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'profile_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified profile does not exist.';
  END IF;

  IF v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'profile_version_mismatch'
      USING ERRCODE = '22000',
            HINT    = 'Profile was modified since the version snapshot. Refetch and retry.';
  END IF;

  UPDATE public.profiles SET
    jlpt_target           = COALESCE(NULLIF(p_patch->>'jlpt_target', '')::public.jlpt_level, jlpt_target),
    study_goal            = COALESCE(p_patch->>'study_goal',                                 study_goal),
    daily_new_cards_limit = COALESCE((p_patch->>'daily_new_cards_limit')::INT,               daily_new_cards_limit),
    daily_review_limit    = COALESCE((p_patch->>'daily_review_limit')::INT,                  daily_review_limit),
    retention_target      = COALESCE((p_patch->>'retention_target')::FLOAT,                  retention_target),
    timezone              = COALESCE(p_patch->>'timezone',                                   timezone),
    native_language       = COALESCE(p_patch->>'native_language',                            native_language),
    version               = version + 1,
    updated_at            = NOW()
  WHERE id = p_user_id;

  IF p_interests IS NOT NULL THEN
    DELETE FROM public.user_interests WHERE user_id = p_user_id;

    IF array_length(p_interests, 1) > 0 THEN
      INSERT INTO public.user_interests (user_id, interest)
      SELECT DISTINCT p_user_id, unnested
        FROM unnest(p_interests) AS unnested
       WHERE unnested IS NOT NULL AND unnested <> ''
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_profile_with_interests(UUID, INT, JSONB, TEXT[]) TO service_role;


-- ─── D. update_deck_with_version_check ────────────────────────────────────────
-- Replaces the inline UPDATE in apps/api/src/services/deck.service.ts → updateDeck.
-- p_patch is the JSONB patch (camelCase off the wire, here as snake_case keys
-- the function reads directly). NULL / missing keys preserve existing values.

CREATE FUNCTION update_deck_with_version_check(
  p_deck_id          UUID,
  p_user_id          UUID,
  p_expected_version INT,
  p_patch            JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_version INT;
BEGIN
  SELECT version
    INTO v_current_version
    FROM public.decks
   WHERE id = p_deck_id
     AND user_id = p_user_id
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
  WHERE id = p_deck_id
    AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_deck_with_version_check(UUID, UUID, INT, JSONB) TO service_role;
