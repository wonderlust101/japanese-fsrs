-- ============================================================
-- Add premade_deck_id to cards so premade source cards can be
-- seeded. The initial schema file already defines this column,
-- but remote DBs initialised before it was added need this patch.
-- ============================================================

-- 1. Add the foreign-key column (idempotent).
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS premade_deck_id UUID REFERENCES premade_decks(id) ON DELETE CASCADE;

-- 2. Create index (idempotent via DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'cards' AND indexname = 'cards_premade_deck_id_idx'
  ) THEN
    CREATE INDEX cards_premade_deck_id_idx ON cards(premade_deck_id);
  END IF;
END;
$$;

-- 3. Relax deck_id to nullable (no-op if already nullable).
ALTER TABLE cards
  ALTER COLUMN deck_id DROP NOT NULL;

-- 4. Add the XOR constraint (exactly one of deck_id / premade_deck_id must be set).
--    Drop first in case a stale version exists, then re-add cleanly.
ALTER TABLE cards
  DROP CONSTRAINT IF EXISTS cards_deck_xor_premade;

ALTER TABLE cards
  ADD CONSTRAINT cards_deck_xor_premade
    CHECK (num_nonnulls(deck_id, premade_deck_id) = 1);
