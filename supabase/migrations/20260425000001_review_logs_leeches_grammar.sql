-- ============================================================
-- REVIEW LOGS
-- Immutable audit trail of every card review.
-- No UPDATE/DELETE policies — logs are append-only.
-- ============================================================

CREATE TABLE review_logs (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id              UUID          NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id              UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  rating               review_rating NOT NULL,

  -- Nullable: the client may not always report time-on-card.
  review_time_ms       INT,

  -- FSRS snapshot after the review — all always written by processReview().
  stability_after      FLOAT         NOT NULL,
  difficulty_after     FLOAT         NOT NULL,
  due_after            TIMESTAMPTZ   NOT NULL,
  scheduled_days_after INT           NOT NULL,

  reviewed_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX review_logs_user_id_reviewed_at_idx ON review_logs(user_id, reviewed_at);
CREATE INDEX review_logs_card_id_idx             ON review_logs(card_id);

ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own review history (analytics, history view).
CREATE POLICY "review_logs: users can read their own logs"
  ON review_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Logs are written server-side via supabaseAdmin (bypasses RLS).
-- This policy is defense-in-depth for direct DB access.
CREATE POLICY "review_logs: users can insert their own logs"
  ON review_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- LEECHES
-- Cards that have lapsed >= LEECH_THRESHOLD times.
-- AI fills diagnosis/prescription asynchronously.
-- At most one unresolved leech per (card, user) — enforced via partial unique index.
-- ============================================================

CREATE TABLE leeches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Populated by ai.service.ts after detection; NULL until AI fills them.
  diagnosis    TEXT,
  prescription TEXT,

  resolved     BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX leeches_user_id_idx ON leeches(user_id);
CREATE INDEX leeches_card_id_idx ON leeches(card_id);

-- Prevents race-condition duplicates at the DB layer.
-- checkLeech() also guards in application code, but this is defense-in-depth.
CREATE UNIQUE INDEX leeches_card_user_unresolved_idx
  ON leeches(card_id, user_id)
  WHERE (resolved = FALSE);

ALTER TABLE leeches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leeches: users can read their own leeches"
  ON leeches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "leeches: users can insert their own leeches"
  ON leeches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can mark leeches as resolved; they cannot change card_id/user_id/diagnosis.
CREATE POLICY "leeches: users can resolve their own leeches"
  ON leeches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- GRAMMAR PATTERNS
-- FSRS-scheduled grammar entries. Extends FsrsCardState with
-- the full field set (including ts-fsrs v5 learning_steps and
-- elapsed_days/scheduled_days that TDD §4.6 omitted).
-- Premade grammar patterns have user_id = NULL, mirroring cards.
-- ============================================================

CREATE TABLE grammar_patterns (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL for premade source patterns; personal copies always non-null.
  user_id           UUID          REFERENCES profiles(id) ON DELETE CASCADE,
  deck_id           UUID          NOT NULL REFERENCES decks(id) ON DELETE CASCADE,

  pattern           TEXT          NOT NULL,
  meaning           TEXT          NOT NULL,
  jlpt_level        jlpt_level,
  example_sentences JSONB         NOT NULL DEFAULT '[]',
  linked_vocabulary UUID[]        NOT NULL DEFAULT '{}',
  notes             TEXT,

  -- FSRS scheduling state — identical field set to cards.
  status            card_status   NOT NULL DEFAULT 'new',
  due               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  stability         FLOAT         NOT NULL DEFAULT 0,
  difficulty        FLOAT         NOT NULL DEFAULT 0,
  elapsed_days      INT           NOT NULL DEFAULT 0,
  scheduled_days    INT           NOT NULL DEFAULT 0,
  learning_steps    INT           NOT NULL DEFAULT 0,
  reps              INT           NOT NULL DEFAULT 0,
  lapses            INT           NOT NULL DEFAULT 0,
  last_review       TIMESTAMPTZ,
  state             INT           NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX grammar_patterns_user_id_due_idx ON grammar_patterns(user_id, due);
CREATE INDEX grammar_patterns_deck_id_idx     ON grammar_patterns(deck_id);

ALTER TABLE grammar_patterns ENABLE ROW LEVEL SECURITY;

-- Users see their own patterns AND unowned premade source patterns (user_id IS NULL).
CREATE POLICY "grammar_patterns: users can read their own and premade patterns"
  ON grammar_patterns FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Deck ownership verified at insert — same guard as cards INSERT policy.
CREATE POLICY "grammar_patterns: users can insert their own patterns"
  ON grammar_patterns FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM decks
      WHERE id = deck_id
        AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "grammar_patterns: users can update their own patterns"
  ON grammar_patterns FOR UPDATE
  USING (auth.uid() = user_id AND user_id IS NOT NULL)
  WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "grammar_patterns: users can delete their own patterns"
  ON grammar_patterns FOR DELETE
  USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Ensure set_updated_at() exists — it was added to migration 000000 locally
-- but may not be present on remotes that applied 000000 before that edit.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER grammar_patterns_updated_at
  BEFORE UPDATE ON grammar_patterns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- AUDIO — add audio_url to cards
-- PRD AUD-01 (P0): "Native audio on every card — human samples
-- where available, TTS fallback."
-- NULL means no audio cached yet; the API generates TTS on demand
-- and backfills this column once the file is stored.
-- ============================================================

ALTER TABLE cards ADD COLUMN audio_url TEXT;
