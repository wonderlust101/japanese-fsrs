-- =============================================================
-- Migration: 20260612000000_sentence_layout_check.sql
--
-- Backend Completion Plan Stage 12 — sentence-layout schema
-- contract. Closes the open-shape gap on sentence-layout cards by
-- tightening the cards_fields_data_shape CHECK constraint to
-- require `ja`, `en`, and `furigana` for `layout_type = 'sentence'`.
--
-- Before this migration:
--   sentence-layout rows passed the CHECK with any non-empty
--   `fields_data` (per 20260504000007). The shape was reserved for
--   future use and the Zod side mirrored that with
--   `SentenceFieldsDataSchema = z.record(z.string(), z.unknown())`.
--
-- After this migration:
--   The CHECK enforces presence of the three required keys on every
--   sentence-layout row, matching the new Zod shape:
--     { ja, en, furigana, breakdown?, audio?, nuance? }
--   The Zod side is updated to the concrete shape in
--   `packages/shared-types/src/schemas/field-shapes.schema.ts` in
--   the same PR; the two sides cannot drift.
--
-- Vocabulary and grammar layouts are unaffected — their required-keys
-- arm of the CHECK is reproduced verbatim.
--
-- Safety / rollback:
--
--   The CHECK constraint is dropped and recreated rather than
--   modified in place — PostgreSQL forbids ALTER CONSTRAINT for
--   CHECK definitions. The recreation uses NOT VALID + VALIDATE
--   CONSTRAINT per docs/DATABASE.md so the brief lock window
--   doesn't block writes against unrelated columns.
--
--   A DO block ahead of the constraint swap counts any sentence-
--   layout rows that would violate the new predicate. If any exist
--   the migration fails loudly with remediation guidance. Today
--   the live database carries zero sentence-layout rows (the seed
--   premade decks in 20260504000000 are all vocabulary/grammar; no
--   service code produces sentence layouts yet), so the guard
--   normally short-circuits with v_violations = 0.
--
--   Backfill plan if the guard ever trips on a future replay:
--     1. List the offending rows with the same predicate.
--     2. Decide per-row whether to (a) backfill fields_data with
--        ja/en/furigana from the legacy `sentence` / `translation`
--        or other free-form keys, or (b) drop the row outright if
--        it was a test artifact.
--     3. Re-run the migration.
--
--   The migration is forward-only per repo policy; no downgrade
--   migration ships.
-- =============================================================


-- ─── 1. Sanity check — count any sentence-layout rows that would violate ────

DO $migration_guard$
DECLARE
  v_violations INT;
BEGIN
  SELECT COUNT(*) INTO v_violations
  FROM public.cards
  WHERE layout_type = 'sentence'
    AND NOT (
      fields_data ? 'ja'
      AND fields_data ? 'en'
      AND fields_data ? 'furigana'
    );

  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'cards_fields_data_shape tightening would reject % sentence-layout row(s) lacking the required ja/en/furigana keys. Backfill those rows (from legacy `sentence`/`translation` fields, or by dropping test-only rows) before re-running this migration.',
      v_violations;
  END IF;
END;
$migration_guard$;


-- ─── 2. Drop and recreate the CHECK with the new sentence-layout arm ────────

ALTER TABLE public.cards DROP CONSTRAINT cards_fields_data_shape;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_fields_data_shape
  CHECK (
    -- Vocabulary and grammar layouts — unchanged predicate from
    -- 20260504000007. Reproduced verbatim so a future audit reading
    -- only this migration's diff can verify the vocabulary/grammar
    -- arm is identical.
    (
      layout_type IN ('vocabulary', 'grammar')
      AND fields_data ? 'word'
      AND fields_data ? 'reading'
      AND fields_data ? 'meaning'
    )
    -- New sentence-layout arm — requires the same three canonical
    -- keys the Stage 12 SentenceFieldsDataSchema mandates. Optional
    -- keys (breakdown, audio, nuance) are not checked at the DB
    -- layer; the Zod parser enforces their shape when present.
    OR (
      layout_type = 'sentence'
      AND fields_data ? 'ja'
      AND fields_data ? 'en'
      AND fields_data ? 'furigana'
    )
  )
  NOT VALID;

-- VALIDATE CONSTRAINT walks existing rows once to confirm none
-- violate. The DO-block guard above already proved this, but
-- ALTER VALIDATE is the documented seal that flips the constraint
-- from NOT VALID to fully enforced. Re-issuing it here is the
-- standard pattern from docs/DATABASE.md.
ALTER TABLE public.cards VALIDATE CONSTRAINT cards_fields_data_shape;


COMMENT ON CONSTRAINT cards_fields_data_shape ON public.cards IS
  'Backend Completion Plan Stage 12 (2026-05-17 tightening). Enforces:
   - vocabulary / grammar layouts carry word + reading + meaning
   - sentence layout carries ja + en + furigana
   Both arms are required-keys checks (JSONB ? operator); the CHECK
   does not whitelist additional keys, so adding optional fields
   (breakdown, audio, nuance, Lapis-style fields) does not require
   a migration.';
