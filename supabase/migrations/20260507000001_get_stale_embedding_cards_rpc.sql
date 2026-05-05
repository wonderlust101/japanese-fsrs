-- =============================================================
-- Migration: 20260507000001_get_stale_embedding_cards_rpc.sql
-- Severity: HIGH
--
-- Adds an RPC that returns a user's cards whose cached embedding
-- predates the most recent content update. The previous service-
-- layer implementation in card.service.ts used PostgREST .filter(),
-- which does not support column-vs-column comparison: the third
-- argument was sent as the literal string "updated_at" rather than
-- a column reference, causing the query to fail or return empty.
--
-- The returned column projection mirrors CARD_COLUMNS in
-- card.service.ts so the existing toCardRow() mapper can consume
-- the result without changes.
-- =============================================================

CREATE OR REPLACE FUNCTION get_stale_embedding_cards(p_user_id UUID)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  deck_id         UUID,
  layout_type     layout_type,
  fields_data     JSONB,
  card_type       card_type,
  parent_card_id  UUID,
  tags            TEXT[],
  jlpt_level      jlpt_level,
  state           INT,
  is_suspended    BOOLEAN,
  due             TIMESTAMPTZ,
  stability       FLOAT,
  difficulty      FLOAT,
  elapsed_days    INT,
  scheduled_days  INT,
  reps            INT,
  lapses          INT,
  last_review     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.user_id,
    c.deck_id,
    c.layout_type,
    c.fields_data,
    c.card_type,
    c.parent_card_id,
    c.tags,
    c.jlpt_level,
    c.state,
    c.is_suspended,
    c.due,
    c.stability,
    c.difficulty,
    c.elapsed_days,
    c.scheduled_days,
    c.reps,
    c.lapses,
    c.last_review,
    c.created_at,
    c.updated_at
  FROM public.cards c
  WHERE c.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND c.embedding_updated_at IS NOT NULL
    AND c.embedding_updated_at < c.updated_at;
$$;
