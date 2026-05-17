'use client'

import { useMemo, useState } from 'react'

import { State } from '@fsrs-japanese/shared-types'

import type { CardsResultRow } from './cards-results-table'

export type CardsFixtureKey = 'off' | 'empty' | 'few' | 'many' | 'loading'

export interface CardsDevState {
  fixture: CardsFixtureKey
  rows:    readonly CardsResultRow[]
  /** Decks present in the fixture rows; used to populate the deck filter
   *  dropdown so the filter actually maps to fixture data. Empty when
   *  fixture is off. */
  decks:   readonly { id: string; name: string }[]
  loading: boolean
}

const FIXTURES: { key: CardsFixtureKey; label: string; description: string }[] = [
  { key: 'off',     label: 'Off',     description: 'Default empty-state shell (live data, none yet).' },
  { key: 'empty',   label: 'Empty',   description: 'Filters / saved view exclude every fixture row.' },
  { key: 'few',     label: 'Few',     description: 'Eight varied cards across four decks.' },
  { key: 'many',    label: 'Many',    description: '120 cards across eight decks. Filters wired against this set.' },
  { key: 'loading', label: 'Loading', description: 'Skeleton rows.' },
]

/**
 * Dev-only fixture switcher for the Cards browser. Renders only in
 * development. Now exposes a `decks` list alongside `rows` so the deck
 * filter dropdown matches the fixture data.
 */
export function useCardsDevState(): { state: CardsDevState; panel: React.ReactNode } {
  const [fixture, setFixture] = useState<CardsFixtureKey>('off')
  const isDev = process.env.NODE_ENV === 'development'

  const rows: readonly CardsResultRow[] =
    fixture === 'few'  ? FEW_ROWS  :
    fixture === 'many' ? MANY_ROWS :
    []

  // Derive the fixture decks from the rows themselves so the filter
  // dropdown is always consistent with what's renderable.
  const decks = useMemo(() => {
    if (rows.length === 0) return []
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.deckId, r.deckName)
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [rows])

  return {
    state: {
      fixture,
      rows,
      decks,
      loading: fixture === 'loading',
    },
    panel: isDev ? <DevPanel fixture={fixture} onChange={setFixture} /> : null,
  }
}

// ─── Panel UI ───────────────────────────────────────────────────────────

function DevPanel({
  fixture,
  onChange,
}: {
  fixture:  CardsFixtureKey
  onChange: (next: CardsFixtureKey) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Off' }

  return (
    <div
      role="region"
      aria-label="Cards page dev state panel"
      className="fixed bottom-4 left-4 z-40 max-w-[18rem] rounded-[2px] border border-soft-hairline bg-warm-paper-raised shadow-[var(--shadow-card)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="ui-motion-colors flex w-full items-center justify-between gap-2 border-b border-soft-hairline px-3 py-2 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
          Dev · Cards state
        </span>
        <span className="font-mono text-[0.6875rem] text-sumi-ink">{active.label}</span>
      </button>

      {open && (
        <div className="p-2.5">
          <fieldset className="space-y-1" aria-label="Cards fixtures">
            {FIXTURES.map((f) => {
              const checked = f.key === fixture
              return (
                <label
                  key={f.key}
                  className={[
                    'ui-motion-colors flex cursor-pointer items-start gap-2 rounded-[2px] border px-2.5 py-1.5 text-xs',
                    checked
                      ? 'border-inari-vermillion bg-inari-vermillion/5'
                      : 'border-transparent hover:border-soft-hairline hover:bg-cream-inset/45',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="cards-fixture"
                    value={f.key}
                    checked={checked}
                    onChange={() => onChange(f.key)}
                    className="mt-0.5 h-3 w-3 accent-inari-vermillion"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sumi-ink">{f.label}</div>
                    <div className="mt-0.5 leading-snug text-faded-sumi">{f.description}</div>
                  </div>
                </label>
              )
            })}
          </fieldset>
        </div>
      )}
    </div>
  )
}

// ─── Fixture vocabulary ─────────────────────────────────────────────────

interface VocabEntry {
  word:         string
  reading:      string
  meaning:      string
  jlpt:         CardsResultRow['jlptLevel']
  partOfSpeech: string
}

// A spread of common JLPT vocab across N5–N1 plus a handful of Beyond-JLPT
// items. Each entry carries a part-of-speech label so the Type column has
// meaningful data to render.
const VOCAB: readonly VocabEntry[] = [
  // ── N5
  { word: '食べる',  reading: 'たべる',     meaning: 'to eat',                jlpt: 'N5', partOfSpeech: 'る-verb' },
  { word: '飲む',    reading: 'のむ',       meaning: 'to drink',              jlpt: 'N5', partOfSpeech: 'う-verb' },
  { word: '行く',    reading: 'いく',       meaning: 'to go',                 jlpt: 'N5', partOfSpeech: 'う-verb' },
  { word: '来る',    reading: 'くる',       meaning: 'to come',               jlpt: 'N5', partOfSpeech: 'irreg verb' },
  { word: '見る',    reading: 'みる',       meaning: 'to see; to look',       jlpt: 'N5', partOfSpeech: 'る-verb' },
  { word: '聞く',    reading: 'きく',       meaning: 'to listen; to ask',     jlpt: 'N5', partOfSpeech: 'う-verb' },
  { word: '本',      reading: 'ほん',       meaning: 'book',                  jlpt: 'N5', partOfSpeech: 'noun' },
  { word: '水',      reading: 'みず',       meaning: 'water',                 jlpt: 'N5', partOfSpeech: 'noun' },
  { word: '人',      reading: 'ひと',       meaning: 'person',                jlpt: 'N5', partOfSpeech: 'noun' },
  { word: '時間',    reading: 'じかん',     meaning: 'time; hour',            jlpt: 'N5', partOfSpeech: 'noun' },
  { word: '学校',    reading: 'がっこう',   meaning: 'school',                jlpt: 'N5', partOfSpeech: 'noun' },
  { word: '友達',    reading: 'ともだち',   meaning: 'friend',                jlpt: 'N5', partOfSpeech: 'noun' },

  // ── N4
  { word: '走る',    reading: 'はしる',     meaning: 'to run',                jlpt: 'N4', partOfSpeech: 'う-verb' },
  { word: '泳ぐ',    reading: 'およぐ',     meaning: 'to swim',               jlpt: 'N4', partOfSpeech: 'う-verb' },
  { word: '歌う',    reading: 'うたう',     meaning: 'to sing',               jlpt: 'N4', partOfSpeech: 'う-verb' },
  { word: '踊る',    reading: 'おどる',     meaning: 'to dance',              jlpt: 'N4', partOfSpeech: 'う-verb' },
  { word: '工場',    reading: 'こうじょう', meaning: 'factory',               jlpt: 'N4', partOfSpeech: 'noun' },
  { word: '空港',    reading: 'くうこう',   meaning: 'airport',               jlpt: 'N4', partOfSpeech: 'noun' },
  { word: '荷物',    reading: 'にもつ',     meaning: 'luggage; package',      jlpt: 'N4', partOfSpeech: 'noun' },
  { word: '家族',    reading: 'かぞく',     meaning: 'family',                jlpt: 'N4', partOfSpeech: 'noun' },
  { word: '映画',    reading: 'えいが',     meaning: 'movie',                 jlpt: 'N4', partOfSpeech: 'noun' },
  { word: '料理',    reading: 'りょうり',   meaning: 'cooking; dish',         jlpt: 'N4', partOfSpeech: 'noun' },
  { word: '冷蔵庫',  reading: 'れいぞうこ', meaning: 'refrigerator',          jlpt: 'N4', partOfSpeech: 'noun' },
  { word: '注意',    reading: 'ちゅうい',   meaning: 'caution; attention',    jlpt: 'N4', partOfSpeech: 'noun' },

  // ── N3
  { word: '大学',    reading: 'だいがく',     meaning: 'university; college', jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '紅葉',    reading: 'もみじ',       meaning: 'autumn leaves',       jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '経験',    reading: 'けいけん',     meaning: 'experience',          jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '質問',    reading: 'しつもん',     meaning: 'question',            jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '辞書',    reading: 'じしょ',       meaning: 'dictionary',          jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '理由',    reading: 'りゆう',       meaning: 'reason',              jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '残念',    reading: 'ざんねん',     meaning: 'regrettable; a pity', jlpt: 'N3', partOfSpeech: 'na-adj' },
  { word: '緊張',    reading: 'きんちょう',   meaning: 'tension; nervousness', jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '優しい',  reading: 'やさしい',     meaning: 'kind; gentle',        jlpt: 'N3', partOfSpeech: 'i-adj' },
  { word: '景色',    reading: 'けしき',       meaning: 'scenery',             jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '伝統',    reading: 'でんとう',     meaning: 'tradition',           jlpt: 'N3', partOfSpeech: 'noun' },
  { word: '機会',    reading: 'きかい',       meaning: 'opportunity',         jlpt: 'N3', partOfSpeech: 'noun' },

  // ── N2
  { word: '懐かしい', reading: 'なつかしい',   meaning: 'nostalgic; dear',     jlpt: 'N2', partOfSpeech: 'i-adj' },
  { word: '判断',    reading: 'はんだん',     meaning: 'judgment',            jlpt: 'N2', partOfSpeech: 'noun' },
  { word: '困難',    reading: 'こんなん',     meaning: 'difficulty',          jlpt: 'N2', partOfSpeech: 'na-adj' },
  { word: '貴重',    reading: 'きちょう',     meaning: 'precious; valuable',  jlpt: 'N2', partOfSpeech: 'na-adj' },
  { word: '影響',    reading: 'えいきょう',   meaning: 'influence; effect',   jlpt: 'N2', partOfSpeech: 'noun' },
  { word: '基本',    reading: 'きほん',       meaning: 'basis; fundamental',  jlpt: 'N2', partOfSpeech: 'noun' },
  { word: '苦労',    reading: 'くろう',       meaning: 'hardship; trouble',   jlpt: 'N2', partOfSpeech: 'noun' },
  { word: '提案',    reading: 'ていあん',     meaning: 'proposal; suggestion', jlpt: 'N2', partOfSpeech: 'noun' },
  { word: '徐々に',  reading: 'じょじょに',   meaning: 'gradually',           jlpt: 'N2', partOfSpeech: 'adv' },
  { word: '結局',    reading: 'けっきょく',   meaning: 'in the end',          jlpt: 'N2', partOfSpeech: 'adv' },

  // ── N1
  { word: '矛盾',    reading: 'むじゅん',     meaning: 'contradiction',       jlpt: 'N1', partOfSpeech: 'noun' },
  { word: '謙遜',    reading: 'けんそん',     meaning: 'modesty; humility',   jlpt: 'N1', partOfSpeech: 'noun' },
  { word: '抽象',    reading: 'ちゅうしょう', meaning: 'abstract',            jlpt: 'N1', partOfSpeech: 'na-adj' },
  { word: '網羅',    reading: 'もうら',       meaning: 'comprehensiveness',   jlpt: 'N1', partOfSpeech: 'noun' },
  { word: '頻繁',    reading: 'ひんぱん',     meaning: 'frequent',            jlpt: 'N1', partOfSpeech: 'na-adj' },
  { word: '披露',    reading: 'ひろう',       meaning: 'unveiling; showing',  jlpt: 'N1', partOfSpeech: 'noun' },
  { word: '潜む',    reading: 'ひそむ',       meaning: 'to lurk; to hide',    jlpt: 'N1', partOfSpeech: 'う-verb' },
  { word: '繊細',    reading: 'せんさい',     meaning: 'delicate; sensitive', jlpt: 'N1', partOfSpeech: 'na-adj' },

  // ── Beyond JLPT
  { word: '木漏れ日', reading: 'こもれび',     meaning: 'sunlight through trees', jlpt: null, partOfSpeech: 'noun' },
  { word: '幽玄',    reading: 'ゆうげん',     meaning: 'subtle profundity',   jlpt: null, partOfSpeech: 'noun' },
  { word: '物の哀れ', reading: 'もののあわれ', meaning: 'pathos of things',    jlpt: null, partOfSpeech: 'noun' },
]

interface DeckSpec {
  id:   string
  name: string
}

const DECK_N5:      DeckSpec = { id: 'deck-n5',      name: 'N5 Vocab' }
const DECK_N4:      DeckSpec = { id: 'deck-n4',      name: 'N4 Vocab' }
const DECK_N3:      DeckSpec = { id: 'deck-n3-core', name: 'N3 Vocab Core' }
const DECK_N2:      DeckSpec = { id: 'deck-n2',      name: 'N2 Vocab' }
const DECK_N1:      DeckSpec = { id: 'deck-n1',      name: 'N1 Vocab' }
const DECK_GENKI:   DeckSpec = { id: 'deck-genki-1', name: 'Genki I 5-8' }
const DECK_KANJI:   DeckSpec = { id: 'deck-kanji',   name: 'Kanji Radicals' }
const DECK_BEYOND:  DeckSpec = { id: 'deck-beyond',  name: 'Beyond JLPT' }

const DECKS: readonly DeckSpec[] = [
  DECK_N5, DECK_N4, DECK_N3, DECK_N2, DECK_N1, DECK_GENKI, DECK_KANJI, DECK_BEYOND,
]

const CARD_TYPES: readonly CardsResultRow['cardType'][] = ['comprehension', 'production', 'listening']

const STATES: readonly { state: State; isSuspended: boolean; weight: number }[] = [
  { state: State.Review,     isSuspended: false, weight: 5 },
  { state: State.Learning,   isSuspended: false, weight: 2 },
  { state: State.New,        isSuspended: false, weight: 2 },
  { state: State.Relearning, isSuspended: false, weight: 1 },
  { state: State.Review,     isSuspended: true,  weight: 1 },
]

/** Tag vocabulary the fixture draws from. */
const TAG_POOL: readonly string[] = [
  'daily',
  'reading',
  'speaking',
  'kanji',
  'verb',
  'noun',
  'adj',
  'food',
  'travel',
  'work',
  'leech',
]

/** Lapse buckets for a realistic spread. ≥ 8 is "leech" territory. */
const LAPSE_BUCKETS: readonly { lapses: number; weight: number }[] = [
  { lapses: 0,  weight: 8 },
  { lapses: 1,  weight: 5 },
  { lapses: 2,  weight: 3 },
  { lapses: 4,  weight: 2 },
  { lapses: 8,  weight: 1 },
  { lapses: 12, weight: 1 },
]

/** Deterministic PRNG so dev sessions render the same fixture every time. */
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

function pickWeighted<T>(rng: () => number, items: readonly { weight: number; value: T }[], fallback: T): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0)
  let pick = rng() * total
  for (const it of items) {
    pick -= it.weight
    if (pick <= 0) return it.value
  }
  const first = items[0]
  return first === undefined ? fallback : first.value
}

function buildRows(count: number, seed: number): readonly CardsResultRow[] {
  const rng = mulberry32(seed)
  const rows: CardsResultRow[] = []
  for (let i = 0; i < count; i++) {
    const vocab = VOCAB[i % VOCAB.length] ?? VOCAB[0]
    if (vocab === undefined) continue
    // Cycle decks by JLPT for a believable distribution, with some variety.
    const jlptDeck =
      vocab.jlpt === 'N5' ? DECK_N5 :
      vocab.jlpt === 'N4' ? (rng() < 0.5 ? DECK_N4 : DECK_GENKI) :
      vocab.jlpt === 'N3' ? DECK_N3 :
      vocab.jlpt === 'N2' ? DECK_N2 :
      vocab.jlpt === 'N1' ? DECK_N1 :
      DECK_BEYOND
    const fallbackDeck = DECKS[Math.floor(rng() * DECKS.length)] ?? DECK_N5
    const deck = rng() < 0.85 ? jlptDeck : fallbackDeck

    const cardType = CARD_TYPES[Math.floor(rng() * CARD_TYPES.length)] ?? 'comprehension'
    const { state, isSuspended } = pickWeighted(
      rng,
      STATES.map((s) => ({ weight: s.weight, value: { state: s.state, isSuspended: s.isSuspended } })),
      { state: State.Review, isSuspended: false },
    )

    // Due date: New cards no due; otherwise spread 0–60 days from now.
    const due = state === State.New
      ? null
      : new Date(Date.now() + Math.floor(rng() * 60) * 24 * 60 * 60 * 1000).toISOString()

    // Tags: 0–3 randomly picked from the pool. Cards with ≥ 8 lapses
    // also get the 'leech' tag automatically (matches what the leech
    // service would do in production).
    const lapses = pickWeighted(
      rng,
      LAPSE_BUCKETS.map((b) => ({ weight: b.weight, value: b.lapses })),
      0,
    )
    const tagCount = Math.floor(rng() * 3) + (rng() < 0.5 ? 1 : 0) // 0–3
    const drawnTags: string[] = []
    const drawableTags = TAG_POOL.filter((t) => t !== 'leech')
    for (let t = 0; t < tagCount; t++) {
      const idx = Math.floor(rng() * drawableTags.length)
      const tag = drawableTags[idx]
      if (tag !== undefined && !drawnTags.includes(tag)) drawnTags.push(tag)
    }
    if (lapses >= 8) drawnTags.push('leech')

    rows.push({
      id:           `fixture-${seed}-${i}`,
      word:         vocab.word,
      reading:      vocab.reading,
      meaning:      vocab.meaning,
      deckId:       deck.id,
      deckName:     deck.name,
      cardType,
      jlptLevel:    vocab.jlpt,
      partOfSpeech: vocab.partOfSpeech,
      tags:         drawnTags,
      state,
      isSuspended,
      lapses,
      due,
    })
  }
  return rows
}

const FEW_ROWS:  readonly CardsResultRow[] = buildRows(8,   1)
const MANY_ROWS: readonly CardsResultRow[] = buildRows(120, 17)
