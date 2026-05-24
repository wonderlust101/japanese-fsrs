/**
 * Shared data types for the Statistics page. The page renders against
 * fixture data in dev mode; the production version will use real data once
 * the API exposes the corresponding endpoints. Types here describe the
 * shape each chart component consumes.
 */

// ── Activity ────────────────────────────────────────────────────────────────

export interface ActivityDay {
  /** ISO date `YYYY-MM-DD`. */
  date:        string
  /** Number of reviews completed that day. */
  count:       number
  /** Retention for the day, 0–1. */
  retention:   number
  /** Estimated review time in seconds. */
  seconds:     number
}

export interface ActivityStats {
  totalReviews: number
  totalSeconds: number
  activeDays:   number
}

// ── Retention ───────────────────────────────────────────────────────────────

export type AnswerRating = 'again' | 'hard' | 'good' | 'easy'

export interface AnswerButtonDistribution {
  again: number
  hard:  number
  good:  number
  easy:  number
}

// ── Cards ───────────────────────────────────────────────────────────────────

export interface MaturityCounts {
  new:        number
  learning:   number
  young:      number
  mature:     number
  suspended:  number
}

export interface DeckCardCount {
  id:         string
  name:       string
  totalCards: number
}

// ── Scheduling ──────────────────────────────────────────────────────────────

export interface IntervalBucket {
  /** Human-readable label like `1d`, `3d`, `7d`, `30d`, `6m+`. */
  label:    string
  /** Number of cards in this interval bucket. */
  count:    number
}

export interface CumulativeDueDay {
  date:        string
  /** Cumulative cards becoming due by this date. */
  cumulative:  number
}

export interface OverdueImpact {
  overdueCount:   number
  totalDueWeek:   number
  overduePercent: number
}

// ── FSRS ────────────────────────────────────────────────────────────────────

export interface FsrsHistogramBucket {
  /** Bucket label (e.g. `0–7 days`, `0.3–0.5`). */
  label:    string
  count:    number
}

export interface FsrsState {
  desiredRetention: number  // 0–1
  trueRetention:    number  // 0–1
  stability:        ReadonlyArray<FsrsHistogramBucket>
  difficulty:       ReadonlyArray<FsrsHistogramBucket>
}

// ── Aggregate page data ─────────────────────────────────────────────────────

export interface StatisticsData {
  activity:    ReadonlyArray<ActivityDay>
  activityStats: ActivityStats
  retention:   ReadonlyArray<ActivityDay>  // reuses ActivityDay (date + retention)
  answerButtons: AnswerButtonDistribution
  maturity:    MaturityCounts
  decks:       ReadonlyArray<DeckCardCount>
  intervals:   ReadonlyArray<IntervalBucket>
  cumulative:  ReadonlyArray<CumulativeDueDay>
  overdue:     OverdueImpact
  fsrs:        FsrsState
}
