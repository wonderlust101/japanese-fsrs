/**
 * Shared data types for the Progress page. The page renders against
 * fixture data when the dev panel is on; otherwise it composes whatever
 * the live API exposes (heatmap + JLPT gap) and falls back to a
 * limited-data empty state when not enough history is present.
 *
 * The shape here is wider than the current API — `mature` notably needs
 * per-day pipeline snapshots that don't exist server-side yet. Fixtures
 * carry the full shape so the design can be evaluated end-to-end while
 * the backend pass catches up.
 */

import type { JLPTLevel } from '@fsrs-japanese/shared-types'

// ── Summary ────────────────────────────────────────────────────────────────

export interface ProgressSummary {
  /** Total cards currently in the "mature" maturity bucket. */
  matureCount:        number
  /** Rolling 30d mean retention, 0–1. */
  retention30d:       number
  /** Days the learner was active out of the last 30. */
  activeDaysLast30:   number
  /** Cards added this calendar month. */
  cardsAddedThisMonth: number
  /** Days since the very first review (for trajectory framing). */
  daysSinceStart:     number
}

// ── Retention ──────────────────────────────────────────────────────────────

export interface RetentionPoint {
  /** ISO date `YYYY-MM-DD`. */
  date:        string
  /** Daily retention 0–1; null when no reviews that day. */
  retention:   number | null
  /** Number of reviews that day. Used to weight the rolling mean. */
  reviews:     number
}

// ── Mature pipeline ────────────────────────────────────────────────────────

export interface MaturePoint {
  /** ISO date `YYYY-MM-DD`. */
  date:       string
  /** Snapshot of the maturity pipeline at end-of-day. */
  new:        number
  learning:   number
  young:      number
  mature:     number
}

export interface MatureMilestone {
  /** Mature-card threshold (100, 250, 500, 1000, 2500, 5000). */
  count: number
  /** ISO date the threshold was crossed. */
  date:  string
}

// ── JLPT ───────────────────────────────────────────────────────────────────

export interface JlptCoverage {
  level:       Exclude<JLPTLevel, 'beyond_jlpt'>
  /** Canonical total cards in the level (e.g. N5 ≈ 800). */
  total:       number
  /** Cards the learner has encountered (added to a deck). */
  encountered: number
  /** Cards the learner currently owns (mature). */
  owned:       number
}

// ── Consistency ────────────────────────────────────────────────────────────

export interface HeatmapCell {
  /** ISO date `YYYY-MM-DD`. */
  date:    string
  /** Reviews completed that day. */
  count:   number
  /** Retention for the day, 0–1; 0 when no reviews. */
  retention: number
}

// ── Page state ─────────────────────────────────────────────────────────────

export type ProgressState = 'strong' | 'plateau' | 'declining' | 'limited'

// ── Aggregate page data ────────────────────────────────────────────────────

export interface ProgressData {
  /** Page-level trajectory classification, used to pick the italic line. */
  state:      ProgressState
  /** ISO date of the earliest review on record (for limited-data math). */
  firstReviewDate: string
  summary:    ProgressSummary
  retention:  ReadonlyArray<RetentionPoint>
  mature:     ReadonlyArray<MaturePoint>
  milestones: ReadonlyArray<MatureMilestone>
  jlpt:       ReadonlyArray<JlptCoverage>
  heatmap:    ReadonlyArray<HeatmapCell>
  /** User's FSRS desiredRetention (0–1) — drives the retention target line. */
  desiredRetention: number
}

// ── Canonical JLPT denominators ────────────────────────────────────────────

/**
 * Approximate total cards per JLPT level, mirroring widely-cited counts
 * (e.g. JLPT Sensei). Treated as the canonical denominator for coverage
 * math everywhere on this page. Sourced once here so any other surface
 * needing the same numbers imports from a single place.
 */
export const JLPT_TOTALS: Readonly<Record<Exclude<JLPTLevel, 'beyond_jlpt'>, number>> = {
  N5:  800,
  N4:  1500,
  N3:  3700,
  N2:  6000,
  N1:  10000,
}
