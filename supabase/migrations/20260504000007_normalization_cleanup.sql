-- ============================================================
-- Normalization & validation cleanup from the DBA audit
-- (M1, M3, M4, M6, M7).
--
-- M1. Replace profiles.interests TEXT[] with a user_interests
--     junction table (1NF + per-interest counting).
-- M3. CHECK that cards.fields_data has the keys its layout requires.
-- M4. Drop the orphaned register_tag enum.
-- M6. Validate profiles.timezone format (regex; immutable).
-- M7. Validate profiles.native_language as ISO 639-1 (or 639-1-Region).
-- ============================================================


-- ─── M1. profiles.interests → user_interests junction table ──────────────────

CREATE TABLE user_interests (
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interest TEXT NOT NULL,
  PRIMARY KEY (user_id, interest)
);

INSERT INTO user_interests (user_id, interest)
SELECT id, unnest(interests)
FROM   profiles
WHERE  array_length(interests, 1) > 0
ON CONFLICT DO NOTHING;

ALTER TABLE profiles DROP COLUMN interests;

ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_interests: users manage their own"
  ON user_interests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── M3. CHECK that fields_data has the keys its layout requires ─────────────
-- The audit found that migration 20260502000004 dropped the discrete
-- content NOT NULL columns into a JSONB bag with no shape guarantee.
-- Prior to this CHECK, a vocabulary card with fields_data='{}' was legal.
--
-- Shape derived from GeneratedCardDataSchema (apps/api/src/schemas/ai.schema.ts):
-- vocabulary AND grammar both require {word, reading, meaning} at minimum
-- (the seed deck uses the same shape for both — `word` stores the grammar
-- pattern text). The 'sentence' layout is reserved but unused, so we accept
-- any non-empty object until that codepath is built out.
ALTER TABLE cards ADD CONSTRAINT cards_fields_data_shape CHECK (
  (
    layout_type IN ('vocabulary', 'grammar')
    AND fields_data ? 'word'
    AND fields_data ? 'reading'
    AND fields_data ? 'meaning'
  )
  OR (
    layout_type = 'sentence'
    AND fields_data <> '{}'::jsonb
  )
);


-- ─── M4. Drop the orphaned register_tag enum ─────────────────────────────────
-- Defined in 20260425000000_initial_schema.sql:12 but its only user
-- (cards.register) was dropped in 20260502000004_align_card_schema.sql:59.
DROP TYPE IF EXISTS register_tag;


-- ─── M6. profiles.timezone validation ────────────────────────────────────────
-- Use the regex form (immutable). The pg_timezone_names membership check
-- would not be valid in a CHECK constraint because pg_timezone_names is
-- a stable view, not an immutable function.
ALTER TABLE profiles ADD CONSTRAINT profiles_timezone_iana
  CHECK (timezone = 'UTC' OR timezone ~ '^[A-Za-z]+(/[A-Za-z_+\-]+)+$');


-- ─── M7. profiles.native_language ISO 639-1 (or 639-1 + Region) ──────────────
-- Catches `'English'`, `'eng'`, `'EN'`, etc.
ALTER TABLE profiles ADD CONSTRAINT profiles_native_language_iso639
  CHECK (native_language ~ '^[a-z]{2}(-[A-Z]{2})?$');
