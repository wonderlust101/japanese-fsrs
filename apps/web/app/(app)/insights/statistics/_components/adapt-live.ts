import type {
  ApiAnalyticsDashboard,
  ApiDeck,
  ApiForecastDay,
  ApiHeatmapDay,
  ApiInsightsDistributions,
  ApiMaturitySnapshot,
} from '@fsrs-japanese/shared-types'

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

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * The FSRS request-retention the backend schedules at when the user hasn't
 * set their own target. Mirrors `profile.retentionTarget`'s default + the
 * project's CLAUDE.md note that the single scheduler runs at 0.85.
 */
const DEFAULT_RETENTION_TARGET = 0.85

// ── Inputs envelope ──────────────────────────────────────────────────────────

export interface LiveStatisticsInputs {
  /** Bundled dashboard payload (heatmap + accuracy + jlptGap + milestones). */
  dashboard:        ApiAnalyticsDashboard | undefined
  /** Per-day maturity-pipeline snapshots, oldest → newest. */
  maturityHistory:  ReadonlyArray<ApiMaturitySnapshot> | undefined
  /** User-owned decks (id + name + cardCount). */
  decks:            ReadonlyArray<ApiDeck> | undefined
  /** Review forecast (14 days). */
  forecast:         ReadonlyArray<ApiForecastDay> | undefined
  /** FSRS request-retention the user is scheduling at. Falls back to 0.85. */
  retentionTarget:  number | null | undefined
  /** Bundled rating + interval + stability + difficulty histograms. */
  distributions:    ApiInsightsDistributions | undefined
}

// ── Public adapter ───────────────────────────────────────────────────────────

/**
 * Maps the bundled live-data inputs onto the StatisticsData shape the page's
 * five sections already consume.
 */
export function adaptLiveStatistics(
  inputs: LiveStatisticsInputs,
): StatisticsData {
  const heatmap       = inputs.dashboard?.heatmap.items ?? []
  const forecast      = inputs.forecast ?? []
  const matHist       = inputs.maturityHistory ?? []
  const decks         = inputs.decks ?? []
  const distributions = inputs.distributions

  const activity      = adaptActivity(heatmap)
  const activityStats = summarizeActivity(activity)

  return {
    activity,
    activityStats,
    // Retention chart only needs the trailing window; mirrors the fixture's
    // `activity.slice(-90)` shape — last 90 days when available.
    retention:     activity.slice(-90),
    answerButtons: distributions?.ratings ?? emptyAnswerButtons(),
    maturity:      adaptMaturity(matHist),
    decks:         adaptDecks(decks),
    intervals:     toHistogramBuckets(distributions?.intervals),
    cumulative:    adaptCumulativeDue(forecast),
    overdue:       adaptOverdue(forecast),
    fsrs:          adaptFsrs({
      retentionTarget: inputs.retentionTarget ?? null,
      activity,
      stability:       distributions?.stability,
      difficulty:      distributions?.difficulty,
    }),
  }
}

/**
 * `true` when there is so little live data that the page would render mostly
 * empty states. The view uses this to surface the "fills in after a few
 * weeks" empty page instead of a row of skeletal charts.
 */
export function hasMeaningfulData(data: StatisticsData): boolean {
  return data.activityStats.totalReviews > 0
}

// ── Activity ─────────────────────────────────────────────────────────────────

function adaptActivity(
  heatmap: ReadonlyArray<ApiHeatmapDay>,
): ActivityDay[] {
  // Heatmap rows arrive newest-first or oldest-first depending on the
  // endpoint's ordering. Sort ascending by date so the trailing slice (used
  // by the retention chart) lines up with the last N calendar days.
  return [...heatmap]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((row) => ({
      date:      row.date,
      count:     row.count,
      // Heatmap retention is 0–100 on the wire (InsightsOverview already
      // normalizes the same way). Convert to 0–1 for the chart components.
      retention: row.count > 0 ? row.retention / 100 : 0,
      // `totalSeconds` is the real per-day duration aggregated from
      // `review_logs.review_time_ms`. Days where every review pre-dates
      // the duration instrumentation read as zero — acceptable; the
      // metric becomes faithful as new reviews accumulate.
      seconds:   row.totalSeconds,
    }))
}

function summarizeActivity(days: ReadonlyArray<ActivityDay>): ActivityStats {
  let totalReviews  = 0
  let totalSeconds  = 0
  let activeDays    = 0
  let currentStreak = 0
  let bestStreak    = 0
  let runStreak     = 0

  for (let i = 0; i < days.length; i += 1) {
    const d = days[i]
    if (d === undefined) continue
    if (d.count > 0) {
      totalReviews += d.count
      totalSeconds += d.seconds
      activeDays   += 1
      runStreak    += 1
      if (runStreak > bestStreak) bestStreak = runStreak
    } else {
      runStreak = 0
    }
  }

  // Walk from the most recent day backward to compute the trailing streak.
  // Stops at the first inactive day to match the fixture summarizer's intent.
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const d = days[i]
    if (d === undefined || d.count <= 0) break
    currentStreak += 1
  }

  return { totalReviews, totalSeconds, activeDays, bestStreak, currentStreak }
}

// ── Maturity ─────────────────────────────────────────────────────────────────

function adaptMaturity(
  matHist: ReadonlyArray<ApiMaturitySnapshot>,
): MaturityCounts {
  if (matHist.length === 0) {
    return { new: 0, learning: 0, young: 0, mature: 0, suspended: 0 }
  }
  // The endpoint emits oldest → newest; the page wants today's snapshot.
  // Take the last entry, defensively recompute with a max() in case rows
  // arrive unsorted from a future caching change.
  const latest = matHist.reduce(
    (best, row) => (row.date > best.date ? row : best),
    matHist[0] as ApiMaturitySnapshot,
  )

  // The wire schema reports review-state cards split by maturity tier:
  // `reviewCount` is the total state=2 population, `matureCount` is the
  // ≥21-day-scheduled subset of that. "Young" in this UI is the rest of
  // state=2. Learning + relearning collapse into the "learning" bucket
  // the chart already shows.
  return {
    new:       latest.newCount,
    learning:  latest.learningCount + latest.relearningCount,
    young:     Math.max(0, latest.reviewCount - latest.matureCount),
    mature:    latest.matureCount,
    // The maturity-history endpoint excludes suspended cards by design
    // (`suspended = FALSE` predicate on the snapshot RPC). No separate
    // signal exists today; the bar collapses the suspended segment to 0
    // until we either expose it on this endpoint or surface it elsewhere.
    suspended: 0,
  }
}

// ── Decks ────────────────────────────────────────────────────────────────────

function adaptDecks(decks: ReadonlyArray<ApiDeck>): ReadonlyArray<DeckCardCount> {
  return decks
    .map((deck) => ({ id: deck.id, name: deck.name, totalCards: deck.cardCount }))
    .sort((a, b) => b.totalCards - a.totalCards)
}

// ── Cumulative due ───────────────────────────────────────────────────────────

function adaptCumulativeDue(
  forecast: ReadonlyArray<ApiForecastDay>,
): ReadonlyArray<CumulativeDueDay> {
  if (forecast.length === 0) return []
  const sorted = [...forecast].sort((a, b) => (a.date < b.date ? -1 : 1))
  const out: CumulativeDueDay[] = []
  let acc = 0
  for (const row of sorted) {
    acc += row.count
    out.push({ date: row.date, cumulative: acc })
  }
  return out
}

// ── Overdue ──────────────────────────────────────────────────────────────────

function adaptOverdue(forecast: ReadonlyArray<ApiForecastDay>): OverdueImpact {
  if (forecast.length === 0) {
    return { overdueCount: 0, totalDueWeek: 0, overduePercent: 0 }
  }
  const sorted        = [...forecast].sort((a, b) => (a.date < b.date ? -1 : 1))
  const today         = sorted[0]
  const overdueCount  = today?.backlogCount ?? 0
  const totalDueWeek  = sorted.slice(0, 7).reduce((acc, d) => acc + d.count, 0)
  const overduePercent = totalDueWeek > 0
    ? (overdueCount / totalDueWeek) * 100
    : 0
  return { overdueCount, totalDueWeek, overduePercent }
}

// ── FSRS ─────────────────────────────────────────────────────────────────────

interface FsrsAdapterInputs {
  retentionTarget: number | null
  activity:        ReadonlyArray<ActivityDay>
  stability:       ReadonlyArray<{ label: string; count: number }> | undefined
  difficulty:      ReadonlyArray<{ label: string; count: number }> | undefined
}

function adaptFsrs({ retentionTarget, activity, stability, difficulty }: FsrsAdapterInputs): FsrsState {
  // True retention = review-weighted mean of per-day retention across the
  // active days the user has reviewed in. Days with no reviews are skipped
  // so a thirty-day vacation doesn't drag the mean toward zero.
  let weightedSum = 0
  let weight      = 0
  for (const day of activity) {
    if (day.count <= 0) continue
    weightedSum += day.retention * day.count
    weight      += day.count
  }
  const trueRetention = weight > 0 ? weightedSum / weight : 0

  return {
    desiredRetention: retentionTarget ?? DEFAULT_RETENTION_TARGET,
    trueRetention,
    stability:  toFsrsHistogramBuckets(stability),
    difficulty: toFsrsHistogramBuckets(difficulty),
  }
}

// ── Histogram bucket projections ─────────────────────────────────────────────

function toHistogramBuckets(
  buckets: ReadonlyArray<{ label: string; count: number }> | undefined,
): ReadonlyArray<IntervalBucket> {
  if (buckets === undefined) return []
  return buckets.map((b) => ({ label: b.label, count: b.count }))
}

function toFsrsHistogramBuckets(
  buckets: ReadonlyArray<{ label: string; count: number }> | undefined,
): ReadonlyArray<FsrsHistogramBucket> {
  if (buckets === undefined) return []
  return buckets.map((b) => ({ label: b.label, count: b.count }))
}

// ── Empty fallbacks ──────────────────────────────────────────────────────────

function emptyAnswerButtons(): AnswerButtonDistribution {
  return { again: 0, hard: 0, good: 0, easy: 0 }
}
