-- =============================================================
-- Migration: 20260514000001_fix_profile_rpc_search_path.sql
--
-- Forward-only fix for the buggy update_profile_with_interests created in
-- 20260514000000. That function pins SET search_path = '' but casts the
-- 'jlpt_target' patch field to `jlpt_level` (unqualified). At runtime the
-- empty search_path can't resolve the type and the function fails with:
--
--   42704: type "jlpt_level" does not exist
--
-- Fix: schema-qualify the cast as `public.jlpt_level`. Body otherwise
-- identical to the original. CREATE OR REPLACE so this is safe to run
-- whether or not the original migration has been applied yet.
-- =============================================================

CREATE OR REPLACE FUNCTION update_profile_with_interests(
  p_user_id   UUID,
  p_patch     JSONB,
  p_interests TEXT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Custom-type casts must be schema-qualified because this function pins
  -- search_path = ''. Built-in types (INT, FLOAT, TEXT) need no qualification.
  UPDATE public.profiles SET
    jlpt_target           = COALESCE(NULLIF(p_patch->>'jlpt_target', '')::public.jlpt_level, jlpt_target),
    study_goal            = COALESCE(p_patch->>'study_goal',                                 study_goal),
    daily_new_cards_limit = COALESCE((p_patch->>'daily_new_cards_limit')::INT,               daily_new_cards_limit),
    daily_review_limit    = COALESCE((p_patch->>'daily_review_limit')::INT,                  daily_review_limit),
    retention_target      = COALESCE((p_patch->>'retention_target')::FLOAT,                  retention_target),
    timezone              = COALESCE(p_patch->>'timezone',                                   timezone),
    native_language       = COALESCE(p_patch->>'native_language',                            native_language),
    updated_at            = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found'
      USING ERRCODE = 'no_data_found',
            HINT    = 'The specified profile does not exist.';
  END IF;

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
