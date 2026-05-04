-- ============================================================
-- Missing-index fixes from the DBA audit (H1–H7).
--
-- Pure performance migration. Each index targets either a foreign-key
-- enforcement scan that the planner cannot serve from existing indexes,
-- or a hot-path filter/sort in an analytics RPC.
-- ============================================================


-- H1. user_premade_subscriptions.premade_deck_id has no usable index.
-- The existing UNIQUE(user_id, premade_deck_id) leads with user_id, so
-- `WHERE premade_deck_id = $1` (the FK enforcement query when a premade
-- deck is deleted) cannot use it.
CREATE INDEX user_premade_subscriptions_premade_deck_id_idx
  ON user_premade_subscriptions(premade_deck_id);


-- H2. decks.source_premade_id has no index. Required for ON DELETE
-- SET NULL cascades from premade_decks AND for the JOIN inside
-- subscribe_to_premade_deck() (`d.source_premade_id = s.premade_deck_id`).
CREATE INDEX decks_source_premade_id_idx
  ON decks(source_premade_id)
  WHERE source_premade_id IS NOT NULL;


-- H3. cards.jlpt_level has no index. get_jlpt_gap() and
-- get_milestone_forecast() filter on (user_id, jlpt_level IS NOT NULL).
CREATE INDEX cards_user_id_jlpt_level_idx
  ON cards(user_id, jlpt_level)
  WHERE user_id IS NOT NULL;


-- H4. review_logs(rating, state_before) are unindexed and used in hot
-- aggregations by get_milestone_forecast(). Partial covering index for
-- the "successful graduation" pattern (state_before < 2 AND rating IN
-- ('good','easy')).
CREATE INDEX review_logs_user_graduations_idx
  ON review_logs(user_id, reviewed_at)
  INCLUDE (state_before, rating)
  WHERE rating IN ('good', 'easy')
    AND state_before IS NOT NULL
    AND state_before < 2;


-- H5. cards.tags TEXT[] has no GIN index. Without it any
-- `WHERE 'kanji' = ANY(tags)` or `tags && ARRAY[...]` is a seq scan.
CREATE INDEX cards_tags_gin_idx ON cards USING gin (tags);


-- H6. cards.fields_data JSONB has no GIN index. Add now so that
-- future "find card by word" / containment queries do not seq-scan.
-- jsonb_path_ops is the right operator class for containment queries.
CREATE INDEX cards_fields_data_gin_idx
  ON cards USING gin (fields_data jsonb_path_ops);


-- H7. leeches is missing the "list user's open leeches" index. The
-- existing leeches_card_user_unresolved_idx is keyed (card_id, user_id)
-- which the planner cannot use for `WHERE user_id = $1 AND resolved = FALSE`.
CREATE INDEX leeches_user_id_unresolved_idx
  ON leeches(user_id)
  WHERE resolved = FALSE;
