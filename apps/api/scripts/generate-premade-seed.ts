/**
 * Generates the full JLPT-vocabulary premade-deck seed migration from the
 * ordered Wiktionary appendix lists in `docs/jlpt_list/` (N5–N1).
 *
 * Output: `supabase/migrations/<TS>_seed_full_jlpt_vocab.sql`. The generated
 * file is what gets reviewed, committed, and applied — this script is the
 * auditable source for those 7,370 INSERT rows. Re-run it whenever the source
 * lists change; the output is deterministic (stable card UUIDs derived from
 * level + ordinal, ON CONFLICT (id) DO NOTHING), so a regenerate-and-diff is
 * meaningful.
 *
 * What the migration does (see the header it emits for the why):
 *   1. Delete the placeholder *source* cards for the five JLPT vocab decks.
 *   2. Delete the three stub decks (Grammar / Joyo Kanji / Beyond JLPT Core)
 *      that have no real data — cascades to their source cards + subscriptions.
 *   3. Adopt the richer deck descriptions from the source lists.
 *   4. Insert the full vocab lists (chunked INSERTs).
 *   5. Refresh premade_decks.card_count for the five vocab decks.
 *
 * Usage:
 *   bun --filter api run premade:seed:generate
 *   (or directly: bun run apps/api/scripts/generate-premade-seed.ts)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ─── Constants ────────────────────────────────────────────────────────────

/** Repo root, resolved from this file (apps/api/scripts → ../../..). */
const REPO_ROOT = resolve(import.meta.dir, '../../..')
const JLPT_DIR = join(REPO_ROOT, 'docs/jlpt_list')
const MIGRATION_PATH = join(
  REPO_ROOT,
  'supabase/migrations/20260703000000_seed_full_jlpt_vocab.sql',
)

/** Rows per INSERT statement — keeps the emitted file parseable. */
const CHUNK_SIZE = 1000

type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

/** Stable premade_decks UUIDs seeded in 20260504000000 (kept, repopulated). */
const DECK_UUID: Record<JlptLevel, string> = {
  N5: '11111111-1111-4111-8111-000000000005',
  N4: '11111111-1111-4111-8111-000000000004',
  N3: '11111111-1111-4111-8111-000000000003',
  N2: '11111111-1111-4111-8111-000000000002',
  N1: '11111111-1111-4111-8111-000000000001',
}

/**
 * Per-level card-UUID prefix, extending the existing placeholder scheme
 * (`a0000005-…` was N5 in the original seed). Final form:
 *   a000000{5..1}-0000-4000-8000-{ordinal:012x}
 * version nibble `4` and variant `8` are fixed, so every value is a valid v4
 * UUID; the 12-hex tail holds the 1-based ordinal (max N1 2818 = 0xB02).
 */
const CARD_UUID_PREFIX: Record<JlptLevel, string> = {
  N5: 'a0000005',
  N4: 'a0000004',
  N3: 'a0000003',
  N2: 'a0000002',
  N1: 'a0000001',
}

/** Stub decks removed wholesale — no real data exists for them yet. */
const STUB_DECK_UUIDS: ReadonlyArray<{ id: string; name: string }> = [
  { id: '22222222-2222-4222-8222-000000000001', name: 'JLPT N5–N1 Grammar' },
  { id: '33333333-3333-4333-8333-000000000001', name: 'Joyo Kanji Grade 1–6' },
  { id: '44444444-4444-4444-8444-000000000001', name: 'Beyond JLPT Core' },
]

/** Order the files are processed in (and the order decks appear in the SQL). */
const LEVELS: ReadonlyArray<JlptLevel> = ['N5', 'N4', 'N3', 'N2', 'N1']

// ─── Source shapes (minimal; validated below) ──────────────────────────────

interface SourceDeck {
  name: string
  description: string
  deckType: string
  jlptLevel: JlptLevel
}

interface SourceCard {
  layoutType: string
  jlptLevel: JlptLevel
  fieldsData: Record<string, unknown>
}

interface SourceFile {
  deck: SourceDeck
  cards: SourceCard[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Postgres single-quoted string literal (doubles embedded quotes). */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function cardUuid(level: JlptLevel, ordinal: number): string {
  const tail = ordinal.toString(16).padStart(12, '0')
  return `${CARD_UUID_PREFIX[level]}-0000-4000-8000-${tail}`
}

function loadLevel(level: JlptLevel): SourceFile {
  const path = join(JLPT_DIR, `jlpt-${level.toLowerCase()}-full.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as SourceFile

  if (parsed.deck.jlptLevel !== level) {
    throw new Error(`${path}: deck.jlptLevel ${parsed.deck.jlptLevel} != ${level}`)
  }
  parsed.cards.forEach((card, i) => {
    const fd = card.fieldsData
    if (card.layoutType !== 'vocabulary') {
      throw new Error(`${level} card ${i}: layoutType ${card.layoutType} != vocabulary`)
    }
    // The cards_fields_data_shape CHECK (vocabulary arm) requires these keys.
    for (const key of ['word', 'reading', 'meaning'] as const) {
      const v = fd[key]
      if (typeof v !== 'string' || v.length === 0) {
        throw new Error(`${level} card ${i} (${String(fd.word)}): missing/empty ${key}`)
      }
    }
  })
  return parsed
}

// ─── Build SQL ────────────────────────────────────────────────────────────

function buildHeader(total: number, perLevel: Record<JlptLevel, number>): string {
  const counts = LEVELS.map((l) => `${l}=${perLevel[l]}`).join(', ')
  return `-- ============================================================
-- Migration: 20260703000000_seed_full_jlpt_vocab.sql
--
-- GENERATED FILE — do not edit by hand. Regenerate with
--   bun --filter api run premade:seed:generate
-- (apps/api/scripts/generate-premade-seed.ts) from docs/jlpt_list/.
--
-- Replaces the ~10-card placeholder JLPT vocabulary decks seeded in
-- 20260504000000 with the full ordered Wiktionary-appendix lists
-- (${counts}; ${total} cards total), and removes the three remaining
-- stub decks (Grammar, Joyo Kanji, Beyond JLPT Core) that have no real
-- data yet.
--
-- Cascade safety: user-owned copies carry premade_deck_id = NULL (see
-- copy_premade_deck, 20260630000004), so the premade_decks DELETE below
-- cascades only to premade *source* cards and user_premade_subscriptions
-- rows — no user-owned card is touched. decks.source_premade_id is
-- ON DELETE SET NULL (attribution only).
--
-- Embeddings are left NULL. Run the backfill once after applying:
--   bun --filter api run embeddings:backfill
--
-- Idempotent: deterministic card UUIDs + ON CONFLICT (id) DO NOTHING.
-- ============================================================`
}

function buildSql(files: Record<JlptLevel, SourceFile>): { sql: string; total: number } {
  const perLevel = {} as Record<JlptLevel, number>
  for (const level of LEVELS) perLevel[level] = files[level].cards.length
  const total = LEVELS.reduce((sum, l) => sum + perLevel[l], 0)

  const out: string[] = [buildHeader(total, perLevel), '']

  // 1. Delete placeholder source cards for the five vocab decks.
  const vocabIds = LEVELS.map((l) => `  ${sqlString(DECK_UUID[l])}`).join(',\n')
  out.push(
    '-- 1. Drop the placeholder *source* cards for the five JLPT vocab decks.',
    "--    Scoped to source rows (user_id IS NULL); user copies have",
    '--    premade_deck_id NULL and never match this predicate.',
    'DELETE FROM cards',
    ` WHERE premade_deck_id IN (\n${vocabIds}\n )`,
    '   AND user_id IS NULL;',
    '',
  )

  // 2. Delete the three stub decks (cascade handles their cards + subs).
  //    Comma must precede the inline comment, else `--` swallows it and the
  //    IN-list loses its separators.
  const stubIds = STUB_DECK_UUIDS.map((d, i) => {
    const comma = i < STUB_DECK_UUIDS.length - 1 ? ',' : ''
    return `  ${sqlString(d.id)}${comma} -- ${d.name}`
  }).join('\n')
  out.push(
    '-- 2. Remove the three stub decks entirely. ON DELETE CASCADE drops their',
    '--    source cards and user_premade_subscriptions rows; decks.source_premade_id',
    '--    is set NULL. User copies (premade_deck_id NULL) are unaffected.',
    'DELETE FROM premade_decks',
    ` WHERE id IN (\n${stubIds}\n );`,
    '',
  )

  // 3. Adopt the richer deck descriptions from the source lists.
  out.push('-- 3. Adopt the richer deck descriptions from the source lists.')
  for (const level of LEVELS) {
    const { description } = files[level].deck
    out.push(
      `UPDATE premade_decks SET description = ${sqlString(description)} WHERE id = ${sqlString(DECK_UUID[level])};`,
    )
  }
  out.push('')

  // 4. Insert the full vocabulary lists, chunked.
  out.push(
    '-- 4. Insert the full vocabulary lists. fields_data is the wire-shape',
    '--    (camelCase) VocabularyFieldsDataSchema object, stored verbatim.',
  )
  for (const level of LEVELS) {
    const { cards } = files[level]
    out.push(`-- ── ${level} (${cards.length} cards) ${'─'.repeat(Math.max(0, 50 - level.length))}`)
    for (let start = 0; start < cards.length; start += CHUNK_SIZE) {
      const chunk = cards.slice(start, start + CHUNK_SIZE)
      out.push('INSERT INTO cards (id, premade_deck_id, layout_type, jlpt_level, fields_data) VALUES')
      const rows = chunk.map((card, i) => {
        const id = cardUuid(level, start + i + 1)
        const json = sqlString(JSON.stringify(card.fieldsData))
        return `  (${sqlString(id)}, ${sqlString(DECK_UUID[level])}, 'vocabulary', ${sqlString(level)}, ${json}::jsonb)`
      })
      out.push(`${rows.join(',\n')}\nON CONFLICT (id) DO NOTHING;`)
      out.push('')
    }
  }

  // 5. Refresh card_count for the five vocab decks.
  out.push(
    '-- 5. Refresh card_count for the five vocab decks (the count trigger only',
    '--    fires for user-owned cards, so premade decks are updated manually).',
    'UPDATE premade_decks pd',
    '   SET card_count = (SELECT COUNT(*) FROM cards c WHERE c.premade_deck_id = pd.id)',
    ` WHERE pd.id IN (\n${vocabIds}\n );`,
    '',
  )

  return { sql: out.join('\n'), total }
}

// ─── Main ────────────────────────────────────────────────────────────────

const files = {} as Record<JlptLevel, SourceFile>
for (const level of LEVELS) files[level] = loadLevel(level)

const { sql, total } = buildSql(files)
writeFileSync(MIGRATION_PATH, sql, 'utf8')

console.log(
  JSON.stringify(
    {
      output: MIGRATION_PATH,
      total,
      perLevel: Object.fromEntries(LEVELS.map((l) => [l, files[l].cards.length])),
      bytes: Buffer.byteLength(sql, 'utf8'),
    },
    null,
    2,
  ),
)
