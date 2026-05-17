import {
  LAPSE_BUCKET_SPEC,
  type ConfusablePair,
  type LapseBucket,
  type LeechRow,
  type MistakeCard,
  type MistakesData,
  type PatternChip,
  type QualityIssue,
} from './mistakesTypes'

/**
 * Mistakes fixtures. Four scenarios:
 *
 *   - clean        — no major mistakes, triggers the empty state.
 *   - many         — full data, all five SectionCards populated.
 *   - leechHeavy   — leech count above the in-page "leech-heavy" threshold,
 *                    page nudges the learner toward repair.
 *   - notEnough    — under 50 reviews in the window, page hides sections
 *                    and renders the limited-data empty state.
 *
 * Today anchor matches Statistics / Progress fixtures.
 */

const TODAY_ISO = '2026-05-17'

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Sample word pool ────────────────────────────────────────────────────────

interface WordEntry {
  word:    string
  reading: string
  meaning: string
  jlpt:    'N5' | 'N4' | 'N3' | 'N2' | 'N1'
}

const WORDS: ReadonlyArray<WordEntry> = [
  { word: '結構', reading: 'けっこう', meaning: 'fine / quite (ambiguous register)', jlpt: 'N3' },
  { word: '微妙', reading: 'びみょう',  meaning: 'delicate / iffy',                  jlpt: 'N3' },
  { word: '都合', reading: 'つごう',    meaning: 'circumstances / convenience',      jlpt: 'N3' },
  { word: '建前', reading: 'たてまえ',  meaning: 'public stance vs honne',           jlpt: 'N2' },
  { word: '本音', reading: 'ほんね',    meaning: 'true feelings',                    jlpt: 'N2' },
  { word: '懐かしい', reading: 'なつかしい', meaning: 'nostalgic',                   jlpt: 'N3' },
  { word: '我慢', reading: 'がまん',    meaning: 'endurance / patience',             jlpt: 'N3' },
  { word: '遠慮', reading: 'えんりょ',  meaning: 'restraint / holding back',         jlpt: 'N3' },
  { word: '辛抱', reading: 'しんぼう',  meaning: 'patient endurance',                jlpt: 'N2' },
  { word: '配慮', reading: 'はいりょ',  meaning: 'consideration',                    jlpt: 'N2' },
  { word: '念のため', reading: 'ねんのため', meaning: 'just in case',                jlpt: 'N3' },
  { word: '一応', reading: 'いちおう',  meaning: 'tentatively / for the time being', jlpt: 'N3' },
  { word: '案外', reading: 'あんがい',  meaning: 'unexpectedly',                     jlpt: 'N2' },
  { word: '意外', reading: 'いがい',    meaning: 'surprising',                       jlpt: 'N3' },
  { word: '相変わらず', reading: 'あいかわらず', meaning: 'as always',               jlpt: 'N3' },
  { word: 'やはり', reading: 'やはり',  meaning: 'as expected',                      jlpt: 'N4' },
]

const DECKS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'deck-n3-core', name: 'N3 Vocab Core' },
  { id: 'deck-kanji',   name: 'Kanji Radicals' },
  { id: 'deck-n4',      name: 'N4 Vocab' },
  { id: 'deck-grammar', name: 'Grammar Patterns' },
]

function buildCard(
  seed: number,
  index: number,
  overrideLapses: number,
  daysSinceLastReview: number | null,
): MistakeCard {
  const rng = mulberry32(seed + index)
  const word = WORDS[index % WORDS.length]
  if (word === undefined) {
    throw new Error('Word index out of range')
  }
  const deck = DECKS[index % DECKS.length] ?? DECKS[0]
  if (deck === undefined) {
    throw new Error('Deck index out of range')
  }
  const ratings: MistakeCard['lastResult'][] = ['again', 'again', 'hard', 'hard', 'good']
  const lastResult = ratings[Math.floor(rng() * ratings.length)] ?? 'again'
  return {
    id:                  `card-fx-${index.toString().padStart(3, '0')}`,
    word:                word.word,
    reading:             word.reading,
    meaning:             word.meaning,
    lapses:              overrideLapses,
    lastResult,
    ageDays:             Math.round(30 + rng() * 180),
    daysSinceLastReview,
    cardType:            'comprehension',
    jlptLevel:           word.jlpt,
    deckId:              deck.id,
    deckName:            deck.name,
  }
}

// ── Lapse-bucket aggregation ───────────────────────────────────────────────

function aggregateBuckets(cards: ReadonlyArray<MistakeCard>): LapseBucket[] {
  return LAPSE_BUCKET_SPEC.map((spec) => {
    const ids = cards
      .filter((c) => c.lapses >= spec.minLapses && (spec.maxLapses === null || c.lapses <= spec.maxLapses))
      .map((c) => c.id)
    return { ...spec, cardIds: ids }
  })
}

// ── Confusables ────────────────────────────────────────────────────────────

const CONFUSABLE_FX: ReadonlyArray<ConfusablePair> = [
  {
    id:         'pair-1',
    aWord:      '建前', aReading: 'たてまえ', aCardId: 'card-fx-003',
    bWord:      '本音', bReading: 'ほんね',   bCardId: 'card-fx-004',
    confusions: 9,
  },
  {
    id:         'pair-2',
    aWord:      '我慢', aReading: 'がまん',   aCardId: 'card-fx-006',
    bWord:      '辛抱', bReading: 'しんぼう', bCardId: 'card-fx-008',
    confusions: 6,
  },
  {
    id:         'pair-3',
    aWord:      '案外', aReading: 'あんがい', aCardId: 'card-fx-012',
    bWord:      '意外', bReading: 'いがい',   bCardId: 'card-fx-013',
    confusions: 5,
  },
  {
    id:         'pair-4',
    aWord:      '一応', aReading: 'いちおう', aCardId: 'card-fx-011',
    bWord:      '念のため', bReading: 'ねんのため', bCardId: 'card-fx-010',
    confusions: 3,
  },
]

// ── Quality issues ─────────────────────────────────────────────────────────

const QUALITY_FX: ReadonlyArray<QualityIssue> = [
  { kind: 'missing-audio',           count: 184 },
  { kind: 'missing-sentence',        count:  62 },
  { kind: 'missing-kanji-breakdown', count:  48 },
  { kind: 'missing-mnemonic',        count:  28 },
  { kind: 'missing-nuance',          count:  14 },
]

// ── Chips ─────────────────────────────────────────────────────────────────

function buildChips(args: {
  topPatternLabel: string
  topPatternCount: number
  leechCount:      number
  qualityCount:    number
}): PatternChip[] {
  return [
    { href: '#mistakes-problem',     label: 'Top pattern', value: `${args.topPatternLabel} · ${args.topPatternCount} cards` },
    { href: '#mistakes-leeches',     label: 'Leeches',     value: `${args.leechCount}` },
    { href: '#mistakes-quality',     label: 'Quality',     value: `${args.qualityCount} cards missing support` },
  ]
}

// ── Fixture builders ──────────────────────────────────────────────────────

/** Many problem cards, a handful of leeches, full data shape. */
export function buildManyFixture(): MistakesData {
  const lapseShape = [3, 2, 4, 6, 3, 5, 2, 7, 4, 9, 2, 3, 11, 6, 2, 8] as const
  const cards: MistakeCard[] = lapseShape.map((lapses, i) =>
    buildCard(101, i, lapses, Math.round(1 + (i % 10))),
  )
  const leechCards = cards.filter((c) => c.lapses >= 8)
  const leeches: LeechRow[] = leechCards.map((c, i) => ({
    ...c,
    flaggedAt: addDays(TODAY_ISO, -(7 + i * 4)),
    diagnosis: i === 0
      ? 'Likely confused with a visually similar kanji compound. Consider a mnemonic that contrasts the two.'
      : 'Production prompt may be ambiguous. Try strengthening the example sentence.',
  }))
  return {
    state:             'many',
    patternDiagnosis:  'Most slipping happens on N3 cards confused with a visually similar word. A small repair pass on three pairs should clear most of the noise.',
    chips:             buildChips({
      topPatternLabel: 'Confused with similar word',
      topPatternCount: 14,
      leechCount:      leeches.length,
      qualityCount:    QUALITY_FX.reduce((acc, q) => acc + q.count, 0),
    }),
    problemCards:      cards,
    lapseBuckets:      aggregateBuckets(cards),
    leeches,
    confusables:       CONFUSABLE_FX,
    qualityIssues:     QUALITY_FX,
    totalReviews:      1086,
  }
}

/** Leech-heavy: 6 leeches; the page nudges toward repair. */
export function buildLeechHeavyFixture(): MistakesData {
  const base = buildManyFixture()
  // Promote a few more cards into the leech zone.
  const cards: MistakeCard[] = base.problemCards.map((c, i) =>
    i % 3 === 0 && c.lapses < 8 ? { ...c, lapses: 8 + (i % 3) } : c,
  )
  const leechCards = cards.filter((c) => c.lapses >= 8)
  const leeches: LeechRow[] = leechCards.map((c, i) => ({
    ...c,
    flaggedAt: addDays(TODAY_ISO, -(5 + i * 3)),
    diagnosis: 'Repeated lapses inside short intervals. Repair recommended.',
  }))
  return {
    ...base,
    state:            'leech-heavy',
    patternDiagnosis: `Repair will save more time than re-review right now. ${leeches.length} cards have crossed the leech threshold inside this window.`,
    chips:            buildChips({
      topPatternLabel: 'Leeches in the pile',
      topPatternCount: leeches.length,
      leechCount:      leeches.length,
      qualityCount:    QUALITY_FX.reduce((acc, q) => acc + q.count, 0),
    }),
    problemCards:     cards,
    lapseBuckets:     aggregateBuckets(cards),
    leeches,
  }
}

/** Clean: nothing flagged. */
export function buildCleanFixture(): MistakesData {
  return {
    state:             'clean',
    patternDiagnosis:  'Your collection is holding clean. Nothing flagged inside this window.',
    chips:             [],
    problemCards:      [],
    lapseBuckets:      aggregateBuckets([]),
    leeches:           [],
    confusables:       [],
    qualityIssues:     [],
    totalReviews:      842,
  }
}

/** Not enough data: under 50 reviews in the window. */
export function buildNotEnoughFixture(): MistakesData {
  return {
    state:             'not-enough',
    patternDiagnosis:  'Mistake patterns need a few weeks of reviews to read.',
    chips:             [],
    problemCards:      [],
    lapseBuckets:      aggregateBuckets([]),
    leeches:           [],
    confusables:       [],
    qualityIssues:     [],
    totalReviews:      28,
  }
}
