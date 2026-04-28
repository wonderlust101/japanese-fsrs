-- ============================================================
-- 1. Replace card_type enum
--    Old: recognition, production, reading, audio, grammar
--    New: comprehension, production, listening  (per TDD §4.4)
-- ============================================================

ALTER TYPE card_type RENAME TO card_type_old;

CREATE TYPE card_type AS ENUM ('comprehension', 'production', 'listening');

ALTER TABLE cards
  ALTER COLUMN card_type DROP DEFAULT,
  ALTER COLUMN card_type TYPE card_type
    USING (
      CASE card_type::text
        WHEN 'recognition' THEN 'comprehension'
        WHEN 'reading'     THEN 'listening'
        WHEN 'audio'       THEN 'listening'
        WHEN 'grammar'     THEN 'production'
        ELSE card_type::text
      END
    )::card_type;

ALTER TABLE cards
  ALTER COLUMN card_type SET DEFAULT 'comprehension';

DROP TYPE card_type_old;

-- ============================================================
-- 2. Add layout_type enum and card columns (TDD §4.4)
--    layout_type drives which fields are valid in fields_data.
--    fields_data replaces the ~12 discrete content columns.
-- ============================================================

CREATE TYPE layout_type AS ENUM ('vocabulary', 'grammar', 'sentence');

ALTER TABLE cards
  ADD COLUMN layout_type layout_type NOT NULL DEFAULT 'vocabulary',
  ADD COLUMN fields_data  JSONB       NOT NULL DEFAULT '{}';

-- ============================================================
-- 3. Remove discrete content columns
--    Content is now stored in fields_data JSONB.
--    tags, jlpt_level, embedding remain as fast-filter metadata.
-- ============================================================

ALTER TABLE cards
  DROP COLUMN IF EXISTS word,
  DROP COLUMN IF EXISTS reading,
  DROP COLUMN IF EXISTS meaning,
  DROP COLUMN IF EXISTS part_of_speech,
  DROP COLUMN IF EXISTS example_sentences,
  DROP COLUMN IF EXISTS kanji_breakdown,
  DROP COLUMN IF EXISTS pitch_accent,
  DROP COLUMN IF EXISTS mnemonics,
  DROP COLUMN IF EXISTS collocations,
  DROP COLUMN IF EXISTS homophones,
  DROP COLUMN IF EXISTS frequency_rank,
  DROP COLUMN IF EXISTS register;

-- ============================================================
-- 4. Add morphological analysis columns (TDD §4.4 v1.3 bridge)
-- ============================================================

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS tokens    JSONB        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ;
