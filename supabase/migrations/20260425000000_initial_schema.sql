-- Enable pgvector for semantic similarity search on card embeddings.
-- Must run before any table that uses the vector type.
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE card_status AS ENUM ('new', 'learning', 'review', 'relearning', 'suspended');
CREATE TYPE card_type   AS ENUM ('recognition', 'production', 'reading', 'audio', 'grammar');
CREATE TYPE jlpt_level  AS ENUM ('N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt');
CREATE TYPE register_tag AS ENUM ('casual', 'formal', 'written', 'archaic', 'slang', 'gendered', 'neutral');
CREATE TYPE deck_type   AS ENUM ('vocabulary', 'grammar', 'kanji', 'mixed');
CREATE TYPE review_rating AS ENUM ('again', 'hard', 'good', 'easy');

-- ============================================================
-- PROFILES
-- Extends auth.users with app-specific user preferences.
-- ============================================================

CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            TEXT UNIQUE,
  native_language     TEXT NOT NULL DEFAULT 'en',
  jlpt_target         jlpt_level,
  study_goal          TEXT,
  interests           TEXT[]        NOT NULL DEFAULT '{}',
  daily_new_cards_limit INT         NOT NULL DEFAULT 20,
  daily_review_limit  INT           NOT NULL DEFAULT 200,
  retention_target    FLOAT         NOT NULL DEFAULT 0.85,
  timezone            TEXT          NOT NULL DEFAULT 'UTC',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: users can read their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Automatically create a profile row when a new auth user is created.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PREMADE DECKS
-- System-owned curated decks (user_id is always NULL).
-- Users subscribe to or fork these; they never mutate them directly.
-- ============================================================

CREATE TABLE premade_decks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  deck_type   deck_type   NOT NULL,
  jlpt_level  jlpt_level,
  domain      TEXT,
  card_count  INT         NOT NULL DEFAULT 0,
  version     INT         NOT NULL DEFAULT 1,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE premade_decks ENABLE ROW LEVEL SECURITY;

-- Everyone can browse active premade decks; no user can write to them via the API.
CREATE POLICY "premade_decks: public read for active decks"
  ON premade_decks FOR SELECT
  USING (is_active = TRUE);

-- ============================================================
-- DECKS
-- User-owned card collections.
-- ============================================================

CREATE TABLE decks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  deck_type        deck_type   NOT NULL DEFAULT 'vocabulary',
  is_public        BOOLEAN     NOT NULL DEFAULT FALSE,
  is_premade_fork  BOOLEAN     NOT NULL DEFAULT FALSE,
  source_premade_id UUID       REFERENCES premade_decks(id) ON DELETE SET NULL,
  card_count       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX decks_user_id_idx ON decks(user_id);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decks: users can read their own decks"
  ON decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "decks: users can insert their own decks"
  ON decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decks: users can update their own decks"
  ON decks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "decks: users can delete their own decks"
  ON decks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- USER PREMADE SUBSCRIPTIONS
-- Junction table tracking which premade decks a user has subscribed to.
-- ============================================================

CREATE TABLE user_premade_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  premade_deck_id UUID        NOT NULL REFERENCES premade_decks(id) ON DELETE CASCADE,
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_version INT       NOT NULL DEFAULT 1,
  UNIQUE (user_id, premade_deck_id)
);

CREATE INDEX user_premade_subscriptions_user_id_idx ON user_premade_subscriptions(user_id);

ALTER TABLE user_premade_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_premade_subscriptions: users manage their own subscriptions"
  ON user_premade_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CARDS
-- Core SRS unit. Premade source cards have user_id = NULL.
-- Personal copies created on subscription always have user_id set.
-- ============================================================

CREATE TABLE cards (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL for premade source cards; set for user-owned cards.
  deck_id          UUID        REFERENCES decks(id) ON DELETE CASCADE,
  -- NULL for user-owned cards; set for premade source cards.
  premade_deck_id  UUID        REFERENCES premade_decks(id) ON DELETE CASCADE,
  -- NULL for premade deck source cards; personal copies always non-null.
  user_id          UUID        REFERENCES profiles(id) ON DELETE CASCADE,

  -- Core content
  word          TEXT        NOT NULL,
  reading       TEXT,
  meaning       TEXT        NOT NULL,
  part_of_speech TEXT,
  jlpt_level    jlpt_level,
  frequency_rank INT,
  register      register_tag NOT NULL DEFAULT 'neutral',

  -- Extended content (AI-generated or user-provided)
  example_sentences JSONB   NOT NULL DEFAULT '[]',
  kanji_breakdown   JSONB   NOT NULL DEFAULT '[]',
  pitch_accent      TEXT,
  mnemonics         JSONB   NOT NULL DEFAULT '[]',
  collocations      TEXT[]  NOT NULL DEFAULT '{}',
  homophones        TEXT[]  NOT NULL DEFAULT '{}',
  tags              TEXT[]  NOT NULL DEFAULT '{}',

  -- Card type
  card_type     card_type   NOT NULL DEFAULT 'recognition',
  parent_card_id UUID       REFERENCES cards(id) ON DELETE SET NULL,

  -- FSRS scheduling state (via ts-fsrs)
  status        card_status NOT NULL DEFAULT 'new',
  due           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stability     FLOAT       NOT NULL DEFAULT 0,
  difficulty    FLOAT       NOT NULL DEFAULT 0,
  elapsed_days   INT         NOT NULL DEFAULT 0,
  scheduled_days INT         NOT NULL DEFAULT 0,
  -- Tracks progress through (re)learning steps in ts-fsrs v5+.
  -- Must be persisted: losing this resets a learning-phase card to step 0.
  learning_steps INT         NOT NULL DEFAULT 0,
  reps           INT         NOT NULL DEFAULT 0,
  lapses         INT         NOT NULL DEFAULT 0,
  last_review    TIMESTAMPTZ,
  -- FSRS internal state integer: 0=New 1=Learning 2=Review 3=Relearning
  state          INT         NOT NULL DEFAULT 0,

  -- pgvector embedding for semantic similarity (text-embedding-3-small = 1536 dims)
  embedding     vector(1536),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Exactly one of deck_id / premade_deck_id must be non-null.
  CONSTRAINT cards_deck_xor_premade CHECK (num_nonnulls(deck_id, premade_deck_id) = 1)
);

-- Covering index for the due-card query: user's cards ordered by due date.
CREATE INDEX cards_user_id_due_idx       ON cards(user_id, due);
CREATE INDEX cards_deck_id_idx           ON cards(deck_id);
CREATE INDEX cards_premade_deck_id_idx   ON cards(premade_deck_id);
CREATE INDEX cards_parent_card_id_idx    ON cards(parent_card_id);

-- IVFFlat index for cosine similarity search via pgvector (<=> operator).
-- lists=100 is appropriate for up to ~1M vectors; tune upward as data grows.
CREATE INDEX cards_embedding_idx
  ON cards USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Users see their own cards AND unowned premade source cards (user_id IS NULL).
CREATE POLICY "cards: users can read their own cards"
  ON cards FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "cards: users can insert their own cards"
  ON cards FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM decks
      WHERE id = deck_id
        AND decks.user_id = auth.uid()
    )
  );

-- Guard: FSRS writes must go through fsrs.service.ts, but the RLS layer
-- still scopes updates to the owning user and blocks writes to premade sources.
CREATE POLICY "cards: users can update their own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id AND user_id IS NOT NULL)
  WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

CREATE POLICY "cards: users can delete their own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- ============================================================
-- UPDATED_AT TRIGGER
-- Keeps updated_at current automatically on every UPDATE,
-- regardless of whether the application layer sets it explicitly.
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER premade_decks_updated_at
  BEFORE UPDATE ON premade_decks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
