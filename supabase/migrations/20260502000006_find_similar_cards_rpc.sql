-- pgvector similarity search RPC for GET /api/v1/cards/:id/similar.
-- Returns up to p_limit cards ordered by cosine similarity to the source card.
-- Both the source and candidate cards must have non-null embeddings.

CREATE OR REPLACE FUNCTION find_similar_cards(
  p_card_id UUID,
  p_user_id UUID,
  p_limit   INT DEFAULT 10
)
RETURNS TABLE (
  id          UUID,
  deck_id     UUID,
  layout_type layout_type,
  card_type   card_type,
  fields_data JSONB,
  tags        TEXT[],
  jlpt_level  jlpt_level,
  similarity  FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.deck_id,
    c.layout_type,
    c.card_type,
    c.fields_data,
    c.tags,
    c.jlpt_level,
    1 - (c.embedding <=> src.embedding) AS similarity
  FROM cards c
  JOIN cards src ON src.id = p_card_id
  WHERE c.user_id       = p_user_id
    AND c.id           != p_card_id
    AND c.embedding     IS NOT NULL
    AND src.embedding   IS NOT NULL
  ORDER BY c.embedding <=> src.embedding
  LIMIT p_limit;
$$;
