-- =============================================================
-- Migration: 20260528000001_update_rpcs_variable_conflict_fix.sql
--
-- Fixes the two RPCs created in migration 20260528000000:
--   - update_card_with_sibling_sync
--   - update_deck_with_version_check
--
-- Both functions started returning a TABLE projection in 20260528000000 so
-- the JS service layer could skip a follow-up SELECT round-trip. RETURNS TABLE
-- creates implicit OUT parameters with the same names as the table columns
-- (`fields_data`, `name`, …); inside the function body, the UPDATE SET clauses
-- reference those columns unqualified on the right-hand side of `=`, which
-- now collides with the OUT parameters. PostgreSQL's default
-- `#variable_conflict` setting is `error`, so the UPDATE raises SQLSTATE 42702
-- "column reference is ambiguous" at runtime — every PATCH /api/v1/cards/:id
-- and PATCH /api/v1/decks/:id returns 500.
--
-- Fix: add `#variable_conflict use_column` at the top of each function body
-- so PostgreSQL prefers the column reference when there's ambiguity. Bodies
-- and signatures are otherwise byte-identical to migration 20260528000000.
--
-- DROP+CREATE rather than CREATE OR REPLACE: changing the body of a
-- function is fine via OR REPLACE, but using DROP+CREATE keeps these
-- migrations symmetric with 20260525000000 / 20260526000000 / 20260528000000.
-- The explicit GRANT EXECUTE TO service_role is re-issued.
-- =============================================================


-- ─── A. update_card_with_sibling_sync — variable conflict fix ─────────────────

DROP FUNCTION update_card_with_sibling_sync(
  UUID, UUID, INT, JSONB, public.layout_type, public.card_type, TEXT[], public.jlpt_level
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
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  deck_id         UUID,
  premade_deck_id UUID,
  layout_type     public.layout_type,
  fields_data     JSONB,
  card_type       public.card_type,
  parent_card_id  UUID,
  tags            TEXT[],
  jlpt_level      public.jlpt_level,
  state           INT,
  is_suspended    BOOLEAN,
  due             TIMESTAMPTZ,
  stability       FLOAT,
  difficulty      FLOAT,
  elapsed_days    INT,
  scheduled_days  INT,
  learning_steps  INT,
  reps            INT,
  lapses          INT,
  last_review     TIMESTAMPTZ,
  version         INT,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_root_id        UUID;
  v_current_version INT;
  v_shared_fields  JSONB := '{}'::jsonb;
BEGIN
  SELECT c.version
    INTO v_current_version
    FROM public.cards c
   WHERE c.id = p_card_id
     AND c.user_id = p_user_id
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

  UPDATE public.cards SET
    fields_data = COALESCE(p_fields_data, fields_data),
    layout_type = COALESCE(p_layout_type, layout_type),
    card_type   = COALESCE(p_card_type,   card_type),
    tags        = COALESCE(p_tags,        tags),
    jlpt_level  = COALESCE(p_jlpt_level,  jlpt_level),
    version     = version + 1,
    updated_at  = NOW()
  WHERE public.cards.id = p_card_id
    AND public.cards.user_id = p_user_id;

  IF p_fields_data IS NOT NULL THEN
    SELECT COALESCE(c.parent_card_id, c.id)
      INTO v_root_id
      FROM public.cards c
     WHERE c.id = p_card_id;

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
       WHERE public.cards.user_id = p_user_id
         AND public.cards.id != p_card_id
         AND (public.cards.parent_card_id = v_root_id OR public.cards.id = v_root_id);
    END IF;
  END IF;

  RETURN QUERY
    SELECT c.id, c.user_id, c.deck_id, c.premade_deck_id, c.layout_type,
           c.fields_data, c.card_type, c.parent_card_id, c.tags, c.jlpt_level,
           c.state, c.is_suspended, c.due, c.stability, c.difficulty,
           c.elapsed_days, c.scheduled_days, c.learning_steps, c.reps, c.lapses,
           c.last_review, c.version, c.created_at, c.updated_at
      FROM public.cards c
     WHERE c.id = p_card_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_card_with_sibling_sync(
  UUID, UUID, INT, JSONB, public.layout_type, public.card_type, TEXT[], public.jlpt_level
) TO service_role;


-- ─── B. update_deck_with_version_check — variable conflict fix ───────────────

DROP FUNCTION update_deck_with_version_check(UUID, UUID, INT, JSONB);

CREATE FUNCTION update_deck_with_version_check(
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
  is_premade_fork   BOOLEAN,
  source_premade_id UUID,
  card_count        INT,
  version           INT,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ
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
    SELECT d.id, d.name, d.description, d.deck_type, d.is_premade_fork,
           d.source_premade_id, d.card_count, d.version, d.created_at, d.updated_at
      FROM public.decks d
     WHERE d.id = p_deck_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_deck_with_version_check(UUID, UUID, INT, JSONB) TO service_role;
