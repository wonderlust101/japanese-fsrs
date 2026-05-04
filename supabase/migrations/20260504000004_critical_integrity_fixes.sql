-- ============================================================
-- Critical data-integrity fixes from the DBA audit (C1–C4).
--
-- C1. Replace grammar_patterns.linked_vocabulary UUID[] with a junction
--     table so referential integrity is enforced (1NF + FK cascades).
-- C2. review_logs.card_id: NOT NULL + ON DELETE CASCADE  →
--                         nullable + ON DELETE SET NULL.
--     Card deletion no longer destroys analytics history.
-- C3. Drop cards.state and grammar_patterns.state. The card_status enum
--     is the single source of truth; the integer is derived by callers.
--     review_logs.state_before stays as an immutable snapshot.
-- C4. Extend update_deck_card_count() to maintain premade_decks.card_count
--     for premade source cards (deck_id IS NULL, premade_deck_id IS NOT NULL).
-- ============================================================


-- ─── C1. linked_vocabulary array → junction table ────────────────────────────

CREATE TABLE grammar_pattern_vocabulary (
  grammar_pattern_id UUID NOT NULL REFERENCES grammar_patterns(id) ON DELETE CASCADE,
  card_id            UUID NOT NULL REFERENCES cards(id)            ON DELETE CASCADE,
  PRIMARY KEY (grammar_pattern_id, card_id)
);

-- Reverse-lookup index: "which grammar patterns reference this card?"
CREATE INDEX grammar_pattern_vocabulary_card_id_idx
  ON grammar_pattern_vocabulary(card_id);

-- Backfill from the about-to-be-dropped array column.
INSERT INTO grammar_pattern_vocabulary (grammar_pattern_id, card_id)
SELECT gp.id, unnest(gp.linked_vocabulary)
FROM   grammar_patterns gp
WHERE  array_length(gp.linked_vocabulary, 1) > 0
ON CONFLICT DO NOTHING;

ALTER TABLE grammar_patterns DROP COLUMN linked_vocabulary;

ALTER TABLE grammar_pattern_vocabulary ENABLE ROW LEVEL SECURITY;

-- Read mirrors grammar_patterns: own + premade source.
CREATE POLICY "grammar_pattern_vocabulary: read"
  ON grammar_pattern_vocabulary FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grammar_patterns gp
      WHERE gp.id = grammar_pattern_id
        AND (gp.user_id = auth.uid() OR gp.user_id IS NULL)
    )
  );

CREATE POLICY "grammar_pattern_vocabulary: insert"
  ON grammar_pattern_vocabulary FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grammar_patterns gp
      WHERE gp.id = grammar_pattern_id AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "grammar_pattern_vocabulary: delete"
  ON grammar_pattern_vocabulary FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM grammar_patterns gp
      WHERE gp.id = grammar_pattern_id AND gp.user_id = auth.uid()
    )
  );


-- ─── C2. review_logs.card_id → nullable + ON DELETE SET NULL ─────────────────

ALTER TABLE review_logs DROP CONSTRAINT review_logs_card_id_fkey;
ALTER TABLE review_logs ALTER COLUMN card_id DROP NOT NULL;
ALTER TABLE review_logs
  ADD CONSTRAINT review_logs_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;


-- ─── C3. Drop cards.state and grammar_patterns.state ─────────────────────────
-- The integer state is now derived from cards.status at the API boundary.
-- review_logs.state_before is preserved as an immutable snapshot.

ALTER TABLE cards            DROP COLUMN state;
ALTER TABLE grammar_patterns DROP COLUMN state;

-- Replace process_review: same param list minus p_state, body stops writing state.
-- DROP first because parameter-list changes are incompatible with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS process_review(
  UUID, UUID, card_status, TIMESTAMPTZ, FLOAT, FLOAT, INT, INT, INT, INT, INT,
  INT, TIMESTAMPTZ, TIMESTAMPTZ, review_rating, INT, FLOAT, FLOAT, TIMESTAMPTZ,
  INT, INT, INT, FLOAT, FLOAT, TIMESTAMPTZ, INT, INT, INT, TIMESTAMPTZ, INT, INT, UUID
);

CREATE FUNCTION process_review(
  p_card_id              UUID,
  p_user_id              UUID,
  p_status               card_status,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_elapsed_days         INT,
  p_scheduled_days       INT,
  p_learning_steps       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_last_review          TIMESTAMPTZ,
  p_updated_at           TIMESTAMPTZ,
  p_rating               review_rating,
  p_review_time_ms       INT,
  p_stability_after      FLOAT,
  p_difficulty_after     FLOAT,
  p_due_after            TIMESTAMPTZ,
  p_scheduled_days_after INT,
  p_leech_threshold      INT,
  p_state_before          INT         DEFAULT NULL,
  p_stability_before      FLOAT       DEFAULT NULL,
  p_difficulty_before     FLOAT       DEFAULT NULL,
  p_due_before            TIMESTAMPTZ DEFAULT NULL,
  p_scheduled_days_before INT         DEFAULT NULL,
  p_learning_steps_before INT         DEFAULT NULL,
  p_elapsed_days_before   INT         DEFAULT NULL,
  p_last_review_before    TIMESTAMPTZ DEFAULT NULL,
  p_reps_before           INT         DEFAULT NULL,
  p_lapses_before         INT         DEFAULT NULL,
  p_session_id            UUID        DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Defense-in-depth: premade source cards must never have FSRS state written.
  IF (SELECT user_id FROM cards WHERE id = p_card_id) IS NULL THEN
    RAISE EXCEPTION 'Cannot process review for premade source card (id=%)', p_card_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE cards
  SET
    status         = p_status,
    due            = p_due,
    stability      = p_stability,
    difficulty     = p_difficulty,
    elapsed_days   = p_elapsed_days,
    scheduled_days = p_scheduled_days,
    learning_steps = p_learning_steps,
    reps           = p_reps,
    lapses         = p_lapses,
    last_review    = p_last_review,
    updated_at     = p_updated_at
  WHERE id = p_card_id
    AND user_id = p_user_id;

  INSERT INTO review_logs (
    card_id, user_id, rating, review_time_ms,
    stability_after, difficulty_after, due_after, scheduled_days_after,
    state_before, stability_before, difficulty_before, due_before,
    scheduled_days_before, learning_steps_before, elapsed_days_before,
    last_review_before, reps_before, lapses_before, session_id
  ) VALUES (
    p_card_id, p_user_id, p_rating, p_review_time_ms,
    p_stability_after, p_difficulty_after, p_due_after, p_scheduled_days_after,
    p_state_before, p_stability_before, p_difficulty_before, p_due_before,
    p_scheduled_days_before, p_learning_steps_before, p_elapsed_days_before,
    p_last_review_before, p_reps_before, p_lapses_before, p_session_id
  );

  IF p_lapses >= p_leech_threshold THEN
    INSERT INTO leeches (card_id, user_id)
    SELECT p_card_id, p_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM   leeches l
      WHERE  l.card_id  = p_card_id
        AND  l.user_id  = p_user_id
        AND  l.resolved = FALSE
    );
  END IF;
END;
$$;

-- Replace process_forget: signature unchanged (it had no p_state); body
-- removes the `state = 0` write since the column no longer exists.
CREATE OR REPLACE FUNCTION process_forget(
  p_card_id              UUID,
  p_user_id              UUID,
  p_due                  TIMESTAMPTZ,
  p_stability            FLOAT,
  p_difficulty           FLOAT,
  p_scheduled_days       INT,
  p_reps                 INT,
  p_lapses               INT,
  p_updated_at           TIMESTAMPTZ,
  p_state_before          INT,
  p_stability_before      FLOAT,
  p_difficulty_before     FLOAT,
  p_due_before            TIMESTAMPTZ,
  p_scheduled_days_before INT,
  p_learning_steps_before INT,
  p_elapsed_days_before   INT,
  p_last_review_before    TIMESTAMPTZ,
  p_reps_before           INT,
  p_lapses_before         INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cards
  SET
    status         = 'new',
    due            = p_due,
    stability      = p_stability,
    difficulty     = p_difficulty,
    elapsed_days   = 0,
    scheduled_days = p_scheduled_days,
    learning_steps = 0,
    reps           = p_reps,
    lapses         = p_lapses,
    last_review    = NULL,
    updated_at     = p_updated_at
  WHERE id = p_card_id
    AND user_id = p_user_id;

  INSERT INTO review_logs (
    card_id, user_id, rating, review_time_ms,
    stability_after, difficulty_after, due_after, scheduled_days_after,
    state_before, stability_before, difficulty_before, due_before,
    scheduled_days_before, learning_steps_before, elapsed_days_before,
    last_review_before, reps_before, lapses_before
  ) VALUES (
    p_card_id, p_user_id, 'manual', NULL,
    p_stability, p_difficulty, p_due, p_scheduled_days,
    p_state_before, p_stability_before, p_difficulty_before, p_due_before,
    p_scheduled_days_before, p_learning_steps_before, p_elapsed_days_before,
    p_last_review_before, p_reps_before, p_lapses_before
  );
END;
$$;

-- Replace get_jlpt_gap: filter on status enum instead of dropped state column.
CREATE OR REPLACE FUNCTION get_jlpt_gap(p_user_id UUID)
RETURNS TABLE(jlpt_level TEXT, total BIGINT, learned BIGINT, due BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.jlpt_level::TEXT,
    COUNT(*),
    COUNT(*) FILTER (WHERE c.status IN ('review', 'relearning')),
    COUNT(*) FILTER (WHERE c.due <= NOW() AND c.status != 'suspended')
  FROM cards c
  WHERE c.user_id = p_user_id
    AND c.jlpt_level IS NOT NULL
  GROUP BY c.jlpt_level
  ORDER BY c.jlpt_level;
$$;

-- Replace get_milestone_forecast: per_level CTE filter `state >= 2` →
-- `status IN ('review', 'relearning')`. The pace CTE keeps using
-- review_logs.state_before since that snapshot column is preserved.
CREATE OR REPLACE FUNCTION get_milestone_forecast(p_user_id UUID)
RETURNS TABLE(
  jlpt_level                  TEXT,
  total                       BIGINT,
  learned                     BIGINT,
  daily_pace                  NUMERIC,
  days_remaining              INT,
  projected_completion_date   DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pace AS (
    SELECT
      CASE
        WHEN COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE) = 0 THEN 0
        ELSE COUNT(*)::NUMERIC
             / GREATEST(COUNT(DISTINCT (rl.reviewed_at AT TIME ZONE 'UTC')::DATE), 1)
      END AS rate
    FROM review_logs rl
    WHERE rl.user_id = p_user_id
      AND rl.reviewed_at >= NOW() - INTERVAL '30 days'
      AND rl.state_before IS NOT NULL
      AND rl.state_before < 2
      AND rl.rating IN ('good', 'easy')
  ),
  per_level AS (
    SELECT
      c.jlpt_level::TEXT                                          AS jlpt_level,
      COUNT(*)                                                     AS total,
      COUNT(*) FILTER (WHERE c.status IN ('review', 'relearning')) AS learned
    FROM cards c
    WHERE c.user_id = p_user_id
      AND c.jlpt_level IS NOT NULL
    GROUP BY c.jlpt_level
  )
  SELECT
    pl.jlpt_level,
    pl.total,
    pl.learned,
    p.rate,
    CASE
      WHEN p.rate IS NULL OR p.rate = 0 THEN NULL
      ELSE CEIL(GREATEST(pl.total - pl.learned, 0) / p.rate)::INT
    END,
    CASE
      WHEN p.rate IS NULL OR p.rate = 0 THEN NULL
      ELSE (CURRENT_DATE
        + (CEIL(GREATEST(pl.total - pl.learned, 0) / p.rate)::INT) * INTERVAL '1 day')::DATE
    END
  FROM per_level pl, pace p
  ORDER BY pl.jlpt_level;
$$;


-- ─── C4. Extend update_deck_card_count() to cover premade_decks ──────────────

CREATE OR REPLACE FUNCTION update_deck_card_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deck_id IS NOT NULL THEN
      UPDATE decks         SET card_count = card_count + 1 WHERE id = NEW.deck_id;
    ELSIF NEW.premade_deck_id IS NOT NULL THEN
      UPDATE premade_decks SET card_count = card_count + 1 WHERE id = NEW.premade_deck_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deck_id IS NOT NULL THEN
      UPDATE decks         SET card_count = card_count - 1 WHERE id = OLD.deck_id;
    ELSIF OLD.premade_deck_id IS NOT NULL THEN
      UPDATE premade_decks SET card_count = card_count - 1 WHERE id = OLD.premade_deck_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
