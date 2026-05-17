import type {
  ActivityDay,
  ActivityStats,
  AnswerButtonDistribution,
  CumulativeDueDay,
  DeckCardCount,
  FsrsHistogramBucket,
  FsrsState,
  IntervalBucket,
  MaturityCounts,
  OverdueImpact,
  StatisticsData,
} from './types'

/**
 * Statistics fixtures. Drives the dev panel; mirrors the shape real API
 * data will take when those endpoints land. Numbers are realistic for a
 * mid-progress JLPT N3 learner with consistent daily practice.
 */

const TODAY_ISO = '2026-05-17'

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return isoFromDate(d)
}

// Seeded random for stable fixtures.
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

// ── Activity (365 days) ─────────────────────────────────────────────────────

function buildActivityDays(seed: number, daysActive: number): ActivityDay[] {
  const rng = mulberry32(seed)
  const out: ActivityDay[] = []
  for (let i = 365 - 1; i >= 0; i -= 1) {
    const date = addDays(TODAY_ISO, -i)
    // Realistic shape: more recent days have higher density; weekends slightly lighter
    const dow = (parseIso(date).getUTCDay() + 6) % 7
    const recencyBoost = (365 - i) / 365  // 0 → 1
    const weekendDip   = dow >= 5 ? 0.7 : 1.0
    const noise        = rng()
    const activeChance = Math.min(0.92, 0.45 + recencyBoost * 0.45) * weekendDip
    const active       = noise < activeChance && i < daysActive
    if (!active) {
      out.push({ date, count: 0, retention: 0, seconds: 0 })
      continue
    }
    const count     = Math.round(15 + rng() * 35 + recencyBoost * 20)
    const retention = 0.78 + rng() * 0.16
    const seconds   = count * (15 + rng() * 8)
    out.push({ date, count, retention, seconds })
  }
  return out
}

function summarizeActivity(days: ReadonlyArray<ActivityDay>): ActivityStats {
  let totalReviews = 0
  let totalSeconds = 0
  let activeDays   = 0
  let currentStreak = 0
  let bestStreak    = 0
  let runStreak     = 0
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const d = days[i]
    if (d === undefined) continue
    if (d.count > 0) {
      totalReviews += d.count
      totalSeconds += d.seconds
      activeDays   += 1
      runStreak    += 1
      if (i === days.length - 1) currentStreak = runStreak
      if (runStreak > bestStreak) bestStreak = runStreak
    } else {
      runStreak = 0
    }
  }
  return { totalReviews, totalSeconds, activeDays, bestStreak, currentStreak }
}

// ── Answer button distribution ──────────────────────────────────────────────

const ANSWER_BUTTONS_FULL: AnswerButtonDistribution = {
  again: 184,
  hard:  312,
  good:  1486,
  easy:  436,
}

const ANSWER_BUTTONS_LIMITED: AnswerButtonDistribution = {
  again: 8,
  hard:  12,
  good:  42,
  easy:  6,
}

// ── Cards composition ──────────────────────────────────────────────────────

const MATURITY_FULL: MaturityCounts = {
  new:       142,
  learning:  84,
  young:     382,
  mature:    624,
  suspended: 18,
}

const MATURITY_LIMITED: MaturityCounts = {
  new:       38,
  learning:  12,
  young:     8,
  mature:    0,
  suspended: 0,
}

const DECKS_FULL: ReadonlyArray<DeckCardCount> = [
  { id: 'deck-n3-core',  name: 'N3 Vocab Core',      totalCards: 482 },
  { id: 'deck-kanji',    name: 'Kanji Radicals',     totalCards: 318 },
  { id: 'deck-n4',       name: 'N4 Vocab',           totalCards: 196 },
  { id: 'deck-genki-1',  name: 'Genki I 5–8',        totalCards: 142 },
  { id: 'deck-grammar',  name: 'Grammar Patterns',   totalCards: 78  },
  { id: 'deck-beyond',   name: 'Beyond JLPT',        totalCards: 34  },
]

const DECKS_LIMITED: ReadonlyArray<DeckCardCount> = [
  { id: 'deck-n5', name: 'N5 Vocab', totalCards: 58 },
]

// ── Scheduling ──────────────────────────────────────────────────────────────

const INTERVALS_FULL: ReadonlyArray<IntervalBucket> = [
  { label: '1d',      count:  82 },
  { label: '3d',      count: 146 },
  { label: '7d',      count: 218 },
  { label: '14d',     count: 184 },
  { label: '30d',     count: 142 },
  { label: '60d',     count:  98 },
  { label: '6m',      count:  64 },
  { label: '1y+',     count:  32 },
]

const INTERVALS_LIMITED: ReadonlyArray<IntervalBucket> = [
  { label: '1d',  count: 24 },
  { label: '3d',  count: 18 },
  { label: '7d',  count:  6 },
  { label: '14d', count:  0 },
  { label: '30d', count:  0 },
  { label: '60d', count:  0 },
  { label: '6m',  count:  0 },
  { label: '1y+', count:  0 },
]

function buildCumulativeDue(seed: number, days: number, perDay: number): CumulativeDueDay[] {
  const rng = mulberry32(seed)
  const out: CumulativeDueDay[] = []
  let acc = 0
  for (let i = 0; i < days; i += 1) {
    const noise = rng() * 0.6 + 0.7  // 0.7–1.3
    acc += Math.round(perDay * noise)
    out.push({ date: addDays(TODAY_ISO, i), cumulative: acc })
  }
  return out
}

const OVERDUE_FULL: OverdueImpact = {
  overdueCount:   24,
  totalDueWeek:   188,
  overduePercent: 12.8,
}

const OVERDUE_CLEAR: OverdueImpact = {
  overdueCount:   0,
  totalDueWeek:   162,
  overduePercent: 0,
}

const OVERDUE_HEAVY: OverdueImpact = {
  overdueCount:   84,
  totalDueWeek:   230,
  overduePercent: 36.5,
}

// ── FSRS ────────────────────────────────────────────────────────────────────

function buildStabilityDist(): ReadonlyArray<FsrsHistogramBucket> {
  return [
    { label: '0–3 days',   count:  84 },
    { label: '3–7 days',   count: 146 },
    { label: '1–2 weeks',  count: 184 },
    { label: '2–4 weeks',  count: 168 },
    { label: '1–2 months', count: 124 },
    { label: '2–6 months', count:  86 },
    { label: '6m+',        count:  48 },
  ]
}

function buildDifficultyDist(): ReadonlyArray<FsrsHistogramBucket> {
  return [
    { label: 'Very easy', count:  68 },
    { label: 'Easy',      count: 184 },
    { label: 'Medium',    count: 312 },
    { label: 'Hard',      count: 196 },
    { label: 'Very hard', count:  82 },
  ]
}

const FSRS_FULL: FsrsState = {
  desiredRetention: 0.90,
  trueRetention:    0.88,
  stability:        buildStabilityDist(),
  difficulty:       buildDifficultyDist(),
  optimizationStatus: 'ready',
  lastOptimizedAt:    '2026-04-30',
}

const FSRS_PENDING: FsrsState = {
  desiredRetention: 0.90,
  trueRetention:    0.82,
  stability:        buildStabilityDist(),
  difficulty:       buildDifficultyDist(),
  optimizationStatus: 'pending',
  lastOptimizedAt:    '2026-03-12',
}

const FSRS_NEVER: FsrsState = {
  desiredRetention: 0.90,
  trueRetention:    0.85,
  stability:        [],
  difficulty:       [],
  optimizationStatus: 'never-run',
  lastOptimizedAt:    null,
}

// ── Fixture builders ────────────────────────────────────────────────────────

/** Mid-progress N3 learner with consistent daily practice. */
export function buildFullFixture(): StatisticsData {
  const activity = buildActivityDays(7, 365)
  return {
    activity,
    activityStats: summarizeActivity(activity),
    retention:     activity.slice(-90),
    answerButtons: ANSWER_BUTTONS_FULL,
    maturity:      MATURITY_FULL,
    decks:         DECKS_FULL,
    intervals:     INTERVALS_FULL,
    cumulative:    buildCumulativeDue(11, 90, 14),
    overdue:       OVERDUE_FULL,
    fsrs:          FSRS_FULL,
  }
}

/** New user with only a couple weeks of activity. */
export function buildLimitedFixture(): StatisticsData {
  const activity = buildActivityDays(31, 14)
  return {
    activity,
    activityStats: summarizeActivity(activity),
    retention:     activity.slice(-14),
    answerButtons: ANSWER_BUTTONS_LIMITED,
    maturity:      MATURITY_LIMITED,
    decks:         DECKS_LIMITED,
    intervals:     INTERVALS_LIMITED,
    cumulative:    buildCumulativeDue(41, 90, 3),
    overdue:       OVERDUE_CLEAR,
    fsrs:          FSRS_NEVER,
  }
}

/** Heavy backlog scenario: overdue cards dominate. */
export function buildHeavyBacklogFixture(): StatisticsData {
  const base = buildFullFixture()
  return {
    ...base,
    overdue: OVERDUE_HEAVY,
    fsrs:    FSRS_PENDING,
  }
}

/** Full data shape, but FSRS hasn't been run yet. */
export function buildNoFsrsFixture(): StatisticsData {
  const base = buildFullFixture()
  return {
    ...base,
    fsrs: FSRS_NEVER,
  }
}
