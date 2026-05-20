import type {
  ApiWeakSpotDrillAttemptResult,
  ApiWeakSpotDrillSessionDetail,
  ApiWeakSpotDrillSessionDetailCard,
} from '@fsrs-japanese/shared-types'

import type { DrillAttemptRecord } from '@/stores/useWeakSpotDrillSessionStore'

/**
 * Dev fixtures for the drill flow (setup → session → summary). Mirrors the
 * weak-spots list `weakSpotsFixtures.ts` pattern: pure builders that return
 * the same shape the network would, so the consumer code path is identical.
 *
 * Wired only in development. The setup page exposes a dev panel that routes
 * to `/insights/weak-spots/drill/dev-<key>`; the session client recognizes
 * the `dev-` prefix and bypasses TanStack Query, seeding the Zustand store
 * directly from the fixture. The summary client recognizes the same prefix
 * and (optionally) seeds attempt records via `?seed=<attemptsKey>` so the
 * post-drill view can be inspected without running through the queue.
 */

export const DEV_SESSION_PREFIX = 'dev-'

// ── Fixture keys ─────────────────────────────────────────────────────────────

export type DrillSessionFixtureKey =
  | 'tiny'        // one card, fast iteration on per-card layout
  | 'small'       // three vocabulary cards
  | 'mixed'       // vocab + sentence + grammar
  | 'large'       // ten cards, exercises pagination + progress bar
  | 'with-orphan' // one card is orphaned (cardId null, fieldsData null)
  | 'with-stale'  // one card carries isStale = true

export type DrillAttemptsFixtureKey =
  | 'all-remembered'
  | 'mostly-missed'
  | 'mixed-rich'

// ── Builders: cards ──────────────────────────────────────────────────────────

interface CardOverrides {
  word?:       string
  reading?:    string
  meaning?:    string
  lapses?:     number
  isStale?:    boolean
  isOrphaned?: boolean
}

let cardCounter = 0
function newCardIds(): { sessionCardId: string; cardId: string; weakSpotId: string } {
  cardCounter += 1
  const id = String(cardCounter).padStart(4, '0')
  return {
    sessionCardId: `dev-sc-${id}`,
    cardId:        `dev-c-${id}`,
    weakSpotId:    `dev-l-${id}`,
  }
}

function vocab(
  ordinal: number,
  overrides: CardOverrides = {},
): ApiWeakSpotDrillSessionDetailCard {
  const ids = newCardIds()
  return {
    ...ids,
    ordinal,
    layoutType: 'vocabulary',
    fieldsData: {
      word:    overrides.word    ?? '見送る',
      reading: overrides.reading ?? 'みおくる',
      meaning: overrides.meaning ?? 'to see off; to escort',
    },
    lapses:     overrides.lapses ?? 6,
    isOrphaned: overrides.isOrphaned ?? false,
    isStale:    overrides.isStale ?? false,
  }
}

function grammar(
  ordinal: number,
  overrides: CardOverrides = {},
): ApiWeakSpotDrillSessionDetailCard {
  const ids = newCardIds()
  return {
    ...ids,
    ordinal,
    layoutType: 'grammar',
    fieldsData: {
      word:    overrides.word    ?? 'にもかかわらず',
      reading: overrides.reading ?? 'にもかかわらず',
      meaning: overrides.meaning ?? 'in spite of; despite',
    },
    lapses:     overrides.lapses ?? 4,
    isOrphaned: false,
    isStale:    overrides.isStale ?? false,
  }
}

function sentence(
  ordinal: number,
  ja: string,
  en: string,
  furigana: string,
  lapses = 5,
): ApiWeakSpotDrillSessionDetailCard {
  const ids = newCardIds()
  return {
    ...ids,
    ordinal,
    layoutType: 'sentence',
    fieldsData: { ja, en, furigana },
    lapses,
    isOrphaned: false,
    isStale:    false,
  }
}

function orphan(ordinal: number): ApiWeakSpotDrillSessionDetailCard {
  const ids = newCardIds()
  return {
    sessionCardId: ids.sessionCardId,
    weakSpotId:    ids.weakSpotId,
    cardId:        null,
    ordinal,
    layoutType:    null,
    fieldsData:    null,
    lapses:        null,
    isOrphaned:    true,
    isStale:       false,
  }
}

// ── Fixture catalogue ────────────────────────────────────────────────────────

const FIXTURE_CATALOGUE: Record<
  DrillSessionFixtureKey,
  () => ApiWeakSpotDrillSessionDetailCard[]
> = {
  tiny: () => [
    vocab(0, { word: '見送る', reading: 'みおくる', meaning: 'to see off; to escort', lapses: 8 }),
  ],

  small: () => [
    vocab(0, { word: '見送る', reading: 'みおくる', meaning: 'to see off; to escort',   lapses: 8 }),
    vocab(1, { word: '預ける', reading: 'あずける', meaning: 'to entrust; to deposit', lapses: 6 }),
    vocab(2, { word: '果たして', reading: 'はたして', meaning: 'really; sure enough',    lapses: 5 }),
  ],

  mixed: () => [
    vocab(0,    { word: '振る舞う', reading: 'ふるまう', meaning: 'to behave; to treat (food)', lapses: 7 }),
    sentence(1,
      '彼女は突然部屋を出て行った。',
      'She suddenly left the room.',
      'かのじょはとつぜんへやをでていった。',
      4,
    ),
    grammar(2,  { word: 'にもかかわらず', meaning: 'in spite of; despite', lapses: 5 }),
    vocab(3,    { word: 'まちまち',   reading: 'まちまち',   meaning: 'varied; mixed',     lapses: 6 }),
    sentence(4,
      '相次ぐ事故で道路が封鎖された。',
      'The road was closed due to successive accidents.',
      'あいつぐじこでどうろがふうさされた。',
      3,
    ),
  ],

  large: () => [
    vocab(0, { word: '見送る',     reading: 'みおくる',   meaning: 'to see off',                  lapses: 12 }),
    vocab(1, { word: '預ける',     reading: 'あずける',   meaning: 'to entrust',                  lapses: 9 }),
    vocab(2, { word: '果たして',   reading: 'はたして',   meaning: 'really; sure enough',         lapses: 7 }),
    vocab(3, { word: '相次ぐ',     reading: 'あいつぐ',   meaning: 'to happen in succession',     lapses: 6 }),
    vocab(4, { word: 'まちまち',   reading: 'まちまち',   meaning: 'varied; mixed',               lapses: 6 }),
    vocab(5, { word: '振る舞う',   reading: 'ふるまう',   meaning: 'to behave; to treat (food)',  lapses: 5 }),
    vocab(6, { word: '取り立てて', reading: 'とりたてて', meaning: 'particularly; especially',    lapses: 8 }),
    grammar(7, { word: 'ものの',     meaning: 'although; but',                                      lapses: 4 }),
    grammar(8, { word: 'ばかりか',   meaning: 'not only … but also',                                lapses: 4 }),
    vocab(9, { word: '案内',       reading: 'あんない',   meaning: 'guidance; information',        lapses: 5 }),
  ],

  'with-orphan': () => [
    vocab(0,  { word: '見送る', reading: 'みおくる', meaning: 'to see off', lapses: 8 }),
    orphan(1),
    vocab(2,  { word: '預ける', reading: 'あずける', meaning: 'to entrust', lapses: 6 }),
    vocab(3,  { word: '振る舞う', reading: 'ふるまう', meaning: 'to behave', lapses: 5 }),
  ],

  'with-stale': () => [
    vocab(0, { word: '見送る', reading: 'みおくる', meaning: 'to see off', lapses: 8 }),
    vocab(1, { word: '預ける', reading: 'あずける', meaning: 'to entrust; to deposit', lapses: 6, isStale: true }),
    vocab(2, { word: '果たして', reading: 'はたして', meaning: 'really; sure enough', lapses: 5 }),
    vocab(3, { word: '相次ぐ', reading: 'あいつぐ', meaning: 'to happen in succession', lapses: 6 }),
  ],
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface DrillSessionFixtureDescriptor {
  key:         DrillSessionFixtureKey
  label:       string
  description: string
}

export const DRILL_SESSION_FIXTURES: ReadonlyArray<DrillSessionFixtureDescriptor> = [
  { key: 'tiny',        label: 'Tiny',        description: '1 vocabulary card — fastest iteration on the per-card layout.' },
  { key: 'small',       label: 'Small',       description: '3 vocabulary cards — quick complete run.' },
  { key: 'mixed',       label: 'Mixed',       description: '5 cards covering vocab, sentence, and grammar layouts.' },
  { key: 'large',       label: 'Large',       description: '10 cards — exercises the progress bar and pagination.' },
  { key: 'with-orphan', label: 'With orphan', description: '4 cards; the second card is orphaned (card no longer exists).' },
  { key: 'with-stale',  label: 'With stale',  description: '4 cards; the second carries the stale flag.' },
]

export function isDevSessionId(sessionId: string): boolean {
  return sessionId.startsWith(DEV_SESSION_PREFIX)
}

export function parseDevSessionKey(sessionId: string): DrillSessionFixtureKey | null {
  if (!isDevSessionId(sessionId)) return null
  const key = sessionId.slice(DEV_SESSION_PREFIX.length) as DrillSessionFixtureKey
  return key in FIXTURE_CATALOGUE ? key : null
}

export function buildDevSessionDetail(
  sessionId: string,
): ApiWeakSpotDrillSessionDetail | null {
  const key = parseDevSessionKey(sessionId)
  if (key === null) return null
  // Reset counter so successive builds of the same fixture produce stable ids
  // within a render pass. Acceptable trade-off given dev-only usage.
  cardCounter = 0
  const cards = FIXTURE_CATALOGUE[key]()
  return {
    sessionId,
    status:                'active',
    isCanonicalStateStale: key === 'with-stale',
    staleCards:            key === 'with-stale' && cards[1] ? [cards[1].cardId ?? ''] : [],
    cards,
  }
}

export function devSessionHref(key: DrillSessionFixtureKey): string {
  return `/insights/weak-spots/drill/${DEV_SESSION_PREFIX}${key}`
}

// ── Attempt fixtures (for summary preview) ───────────────────────────────────

export interface DrillAttemptsFixtureDescriptor {
  key:         DrillAttemptsFixtureKey
  label:       string
  description: string
}

export const DRILL_ATTEMPT_FIXTURES: ReadonlyArray<DrillAttemptsFixtureDescriptor> = [
  { key: 'all-remembered', label: 'All remembered', description: 'Every card answered "remembered" on first pass.' },
  { key: 'mostly-missed',  label: 'Mostly missed',  description: 'High-friction session — most cards missed, some hesitated.' },
  { key: 'mixed-rich',     label: 'Mixed rich',     description: 'A realistic spread including a repeated-missed-then-remembered card.' },
]

function attempt(
  sessionCardId: string,
  result: ApiWeakSpotDrillAttemptResult,
  responseTimeMs: number,
  index: number,
): DrillAttemptRecord {
  // Stable timestamps so the summary renders deterministically. Base near "now"
  // so the time-of-day chip looks plausible.
  const base = Date.now() - (60_000 - index * 4_000)
  return {
    eventId:         `dev-ev-${index}`,
    sessionCardId,
    weakSpotId:      `dev-l-${sessionCardId.slice(-4)}`,
    cardId:          `dev-c-${sessionCardId.slice(-4)}`,
    result,
    shownAt:         new Date(base - responseTimeMs).toISOString(),
    answeredAt:      new Date(base).toISOString(),
    responseTimeMs,
    countedAsReview: false,
  }
}

export function buildDevAttempts(
  sessionId: string,
  key: DrillAttemptsFixtureKey,
): { queue: ApiWeakSpotDrillSessionDetailCard[]; attempts: DrillAttemptRecord[] } | null {
  const queue = buildDevSessionDetail(sessionId)?.cards ?? null
  if (queue === null) return null

  const attempts: DrillAttemptRecord[] = []
  if (key === 'all-remembered') {
    queue.forEach((card, i) =>
      attempts.push(attempt(card.sessionCardId, 'remembered', 1800 + i * 200, i)),
    )
  } else if (key === 'mostly-missed') {
    queue.forEach((card, i) => {
      const result: ApiWeakSpotDrillAttemptResult =
        i % 4 === 0 ? 'remembered' : i % 3 === 0 ? 'hesitated' : 'missed'
      attempts.push(attempt(card.sessionCardId, result, 3200 + i * 350, i))
    })
  } else {
    queue.forEach((card, i) => {
      const result: ApiWeakSpotDrillAttemptResult =
        i === 0 ? 'missed' : i === 1 ? 'hesitated' : i === 2 ? 'missed' : 'remembered'
      attempts.push(attempt(card.sessionCardId, result, 1500 + i * 400, i))
    })
    // Re-presentation: first card missed again, then remembered — exercises the
    // first-pass-recall denominator + "still need attention" sort path.
    const first = queue[0]
    if (first !== undefined) {
      attempts.push(attempt(first.sessionCardId, 'remembered', 1100, queue.length))
    }
  }
  return { queue, attempts }
}
