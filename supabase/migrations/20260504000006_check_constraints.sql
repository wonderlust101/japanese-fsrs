-- ============================================================
-- CHECK-constraint cluster fix from the DBA audit (M5).
--
-- The schema accepts retention_target=17.4, daily_new_cards_limit=-5,
-- card_count=-3, etc. The application layer is the only line of
-- defense, and SECURITY DEFINER RPCs write directly without the API
-- ever seeing the values. Add DB-level guards.
--
-- Note: cards/grammar_patterns state_range CHECKs are intentionally
-- omitted — migration 20260504000004 dropped the `state` column.
-- ============================================================

ALTER TABLE profiles
  ADD CONSTRAINT profiles_retention_target_range
    CHECK (retention_target > 0 AND retention_target <= 1),
  ADD CONSTRAINT profiles_daily_new_cards_limit_nonneg
    CHECK (daily_new_cards_limit >= 0),
  ADD CONSTRAINT profiles_daily_review_limit_nonneg
    CHECK (daily_review_limit >= 0);

ALTER TABLE decks
  ADD CONSTRAINT decks_card_count_nonneg
    CHECK (card_count >= 0);

ALTER TABLE premade_decks
  ADD CONSTRAINT premade_decks_card_count_nonneg
    CHECK (card_count >= 0),
  ADD CONSTRAINT premade_decks_version_positive
    CHECK (version >= 1);

ALTER TABLE cards
  ADD CONSTRAINT cards_stability_nonneg     CHECK (stability >= 0),
  ADD CONSTRAINT cards_difficulty_nonneg    CHECK (difficulty >= 0),
  ADD CONSTRAINT cards_elapsed_days_nonneg  CHECK (elapsed_days >= 0),
  ADD CONSTRAINT cards_scheduled_days_nonneg CHECK (scheduled_days >= 0),
  ADD CONSTRAINT cards_learning_steps_nonneg CHECK (learning_steps >= 0),
  ADD CONSTRAINT cards_reps_nonneg          CHECK (reps >= 0),
  ADD CONSTRAINT cards_lapses_nonneg        CHECK (lapses >= 0);

ALTER TABLE grammar_patterns
  ADD CONSTRAINT grammar_patterns_stability_nonneg     CHECK (stability >= 0),
  ADD CONSTRAINT grammar_patterns_difficulty_nonneg    CHECK (difficulty >= 0),
  ADD CONSTRAINT grammar_patterns_elapsed_days_nonneg  CHECK (elapsed_days >= 0),
  ADD CONSTRAINT grammar_patterns_scheduled_days_nonneg CHECK (scheduled_days >= 0),
  ADD CONSTRAINT grammar_patterns_learning_steps_nonneg CHECK (learning_steps >= 0),
  ADD CONSTRAINT grammar_patterns_reps_nonneg          CHECK (reps >= 0),
  ADD CONSTRAINT grammar_patterns_lapses_nonneg        CHECK (lapses >= 0);

ALTER TABLE review_logs
  ADD CONSTRAINT review_logs_review_time_ms_nonneg
    CHECK (review_time_ms IS NULL OR review_time_ms >= 0),
  ADD CONSTRAINT review_logs_state_before_range
    CHECK (state_before IS NULL OR state_before BETWEEN 0 AND 3);
