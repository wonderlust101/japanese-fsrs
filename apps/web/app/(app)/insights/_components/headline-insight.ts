import type {
  ApiAnalyticsDashboard,
  ApiHeatmapDay,
  ApiJlptGap,
  ApiLayoutAccuracy,
} from '@fsrs-japanese/shared-types'

export type InsightTone = 'celebratory' | 'attention' | 'neutral' | 'new-user'

export interface HeadlineInsight {
  /** Plain-text headline. The emphasized noun is delimited by `*…*` markers. */
  text: string
  /** Tone drives the optional vermillion/amber emphasis treatment. */
  tone: InsightTone
}

export interface HeadlineInputs {
  heatmap:  ReadonlyArray<ApiHeatmapDay>
  accuracy: ReadonlyArray<ApiLayoutAccuracy>
  jlptGap:  ReadonlyArray<ApiJlptGap>
}

/** Days of activity required before insights are considered meaningful. */
export const MIN_ACTIVE_DAYS_FOR_INSIGHTS = 3

/** Deterministic seed pick — identical to `pickPreparationLine`'s shape. */
function pickByDate<T>(seed: string, pool: ReadonlyArray<T>, fallback: T): T {
  if (pool.length === 0) return fallback
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return pool[hash % pool.length] ?? fallback
}

function activeDays(heatmap: ReadonlyArray<ApiHeatmapDay>): number {
  return heatmap.filter((d) => d.count > 0).length
}

/**
 * Average retention over the most recent N days that had activity. Returns
 * null when fewer than `min` active days are available, so callers can defer
 * to the new-user branch.
 */
function meanRetention(
  heatmap: ReadonlyArray<ApiHeatmapDay>,
  windowSize: number,
  min = 3,
): number | null {
  const recent = [...heatmap]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .filter((d) => d.count > 0)
    .slice(0, windowSize)
  if (recent.length < min) return null
  const sum = recent.reduce((acc, d) => acc + d.retention, 0)
  return sum / recent.length
}

function weakestLayout(
  accuracy: ReadonlyArray<ApiLayoutAccuracy>,
): ApiLayoutAccuracy | null {
  const ranked = [...accuracy].filter((a) => a.total >= 10).sort(
    (a, b) => a.accuracyPct - b.accuracyPct,
  )
  return ranked[0] ?? null
}

function activeJlptLevel(
  gap: ReadonlyArray<ApiJlptGap>,
): ApiJlptGap | null {
  const ranked = [...gap]
    .filter((g) => g.total > 0 && g.progressPct > 0 && g.progressPct < 100)
    .sort((a, b) => b.progressPct - a.progressPct)
  return ranked[0] ?? null
}

function layoutNoun(layout: ApiLayoutAccuracy['layout']): string {
  switch (layout) {
    case 'comprehension': return 'comprehension'
    case 'production':    return 'production'
    case 'listening':     return 'listening'
    default:              return layout
  }
}

function jlptName(level: ApiJlptGap['jlptLevel']): string {
  return level === 'beyond_jlpt' ? 'Beyond-JLPT' : level
}

/**
 * Pick a single headline insight. Priority:
 *   1. concerning retention drop
 *   2. weakest layout (when meaningfully behind)
 *   3. JLPT level the learner is mid-way through
 *   4. neutral activity observation
 * Falls back to a teacher-voice new-user line when data is sparse.
 *
 * `seed` should be the ISO date so the same observation holds across a day
 * but rotates when ties exist.
 */
export function pickHeadlineInsight(
  inputs: HeadlineInputs,
  seed: string,
): HeadlineInsight {
  const { heatmap, accuracy, jlptGap } = inputs
  const days = activeDays(heatmap)

  if (days < MIN_ACTIVE_DAYS_FOR_INSIGHTS) {
    return {
      tone: 'new-user',
      text: 'Insights need a few sessions to find their shape. *Three or four more* will do it.',
    }
  }

  const recent = meanRetention(heatmap, 7)
  const trailing = meanRetention(heatmap, 30, 7)

  // (1) Concerning drop — recent retention well below trailing average.
  if (recent !== null && trailing !== null && trailing - recent >= 0.08) {
    const drop = Math.round((trailing - recent) * 100)
    return {
      tone: 'attention',
      text: `Your retention has slipped by *${drop} points* this week. Worth a closer look at what changed.`,
    }
  }

  // Celebratory — strong recent retention vs trailing.
  if (recent !== null && trailing !== null && recent - trailing >= 0.05 && recent >= 0.85) {
    const lift = Math.round(recent * 100)
    return {
      tone: 'celebratory',
      text: `Retention is holding at *${lift}%* this week — your strongest stretch in a month.`,
    }
  }

  // (2) Weakest layout, when meaningfully behind.
  const weak = weakestLayout(accuracy)
  if (weak !== null && weak.accuracyPct < 75) {
    const noun = layoutNoun(weak.layout)
    return {
      tone: 'attention',
      text: `Your *${noun}* cards are landing at ${Math.round(weak.accuracyPct)}% — the layout most worth your attention.`,
    }
  }

  // (3) JLPT level mid-stream.
  const level = activeJlptLevel(jlptGap)
  if (level !== null) {
    return {
      tone: 'neutral',
      text: `You're *${Math.round(level.progressPct)}% through ${jlptName(level.jlptLevel)}* — ${level.total - level.learned} cards left to learn.`,
    }
  }

  // (4) Neutral activity observation, date-rotated for variety on ties.
  const totalReviews = heatmap.reduce((acc, d) => acc + d.count, 0)
  const fallbackLine = `You reviewed *${totalReviews} cards* across ${days} sessions this stretch.`
  const lines: ReadonlyArray<string> = [
    fallbackLine,
    `*${days} sessions* in the books. The schedule keeps moving while you do.`,
    `Steady week: *${totalReviews} cards reviewed*, and the rhythm shows.`,
  ]
  return { tone: 'neutral', text: pickByDate(seed, lines, fallbackLine) }
}

/**
 * Lightweight helper for the `pickHeadlineInsight` consumer — splits the
 * `*emphasized*` segments out so the renderer can style them. Returns an
 * alternating array of plain and emphasized chunks.
 */
export function splitEmphasis(text: string): Array<{ kind: 'plain' | 'em'; text: string }> {
  const parts: Array<{ kind: 'plain' | 'em'; text: string }> = []
  let cursor = 0
  const re = /\*([^*]+)\*/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ kind: 'plain', text: text.slice(cursor, match.index) })
    }
    parts.push({ kind: 'em', text: match[1] ?? '' })
    cursor = re.lastIndex
  }
  if (cursor < text.length) parts.push({ kind: 'plain', text: text.slice(cursor) })
  return parts
}

/** Resolves a dashboard envelope into the inputs `pickHeadlineInsight` needs. */
export function buildHeadlineInputs(
  dashboard: ApiAnalyticsDashboard | undefined,
): HeadlineInputs {
  return {
    heatmap:  dashboard?.heatmap.items   ?? [],
    accuracy: dashboard?.accuracy.items  ?? [],
    jlptGap:  dashboard?.jlptGap.items   ?? [],
  }
}
