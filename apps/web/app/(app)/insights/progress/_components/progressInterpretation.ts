import type { ProgressData, ProgressState } from './progressTypes'

/**
 * Interpretation builders for the Progress page. The brief asks every
 * chart to pair with a single plain-language read; these helpers turn
 * raw data into those one-liner sentences and keep the wording
 * consistent across states.
 *
 * Voice rules: editorial, specific, no em-dashes, no cheerleading.
 * Numbers are woven into prose where it reads naturally; otherwise
 * left to the chart itself.
 */

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function withCommas(n: number): string {
  return n.toLocaleString('en-US')
}

// ── Page state classification ──────────────────────────────────────────────

const LIMITED_THRESHOLD_DAYS = 14

export function classifyProgress(data: Pick<ProgressData, 'retention' | 'mature' | 'desiredRetention' | 'summary'>): ProgressState {
  const days = data.retention.length
  if (days < LIMITED_THRESHOLD_DAYS) return 'limited'

  const recent = data.retention.slice(-21).filter((p) => p.retention !== null) as Array<{ retention: number }>
  if (recent.length === 0) return 'limited'

  const mean = recent.reduce((acc, p) => acc + p.retention, 0) / recent.length
  if (mean < data.desiredRetention - 0.03) return 'declining'

  const last30 = data.mature.slice(-30)
  if (last30.length >= 2) {
    const first = last30[0]
    const final = last30[last30.length - 1]
    if (first !== undefined && final !== undefined) {
      const growth = final.mature - first.mature
      if (growth < 5) return 'plateau'
    }
  }
  return 'strong'
}

// ── Header italic line ─────────────────────────────────────────────────────

export function buildHeaderLine(data: ProgressData): string {
  const { summary, retention } = data
  const recentReviews = retention.slice(-30).filter((p) => p.retention !== null) as Array<{ retention: number }>
  const r = recentReviews.length > 0
    ? recentReviews.reduce((acc, p) => acc + p.retention, 0) / recentReviews.length
    : summary.retention30d

  switch (data.state) {
    case 'strong':
      return `Memory is holding at ${pct(r)}, and ${withCommas(summary.matureCount)} cards now live in long-term storage.`
    case 'plateau':
      return `Retention is steady at ${pct(r)}, but the mature pile has been flat for the past month.`
    case 'declining':
      return `Retention has slipped to ${pct(r)}, ${Math.round((data.desiredRetention - r) * 100)} points below your target.`
    case 'limited':
      return `Progress takes a beat to settle.`
  }
}

// ── Retention interpretation ──────────────────────────────────────────────

export function buildRetentionLine(data: ProgressData): string {
  const recent = data.retention.slice(-30).filter((p) => p.retention !== null) as Array<{ retention: number }>
  if (recent.length === 0) return 'Not enough reviews to read retention yet.'
  const mean = recent.reduce((acc, p) => acc + p.retention, 0) / recent.length
  const target = data.desiredRetention
  const delta = Math.round((mean - target) * 100)

  if (data.state === 'declining') {
    return `Down ${Math.abs(delta)} points from your ${pct(target)} target. The Mistakes page will show which cards are slipping.`
  }
  if (delta >= 0) return `Inside the everyday range and at or above your ${pct(target)} target.`
  return `Within a couple points of your ${pct(target)} target, holding steady.`
}

// ── Mature interpretation ─────────────────────────────────────────────────

export function buildMatureLine(data: ProgressData): string {
  const series = data.mature
  if (series.length < 14) return 'A few more weeks of practice will fill this chart.'
  const last = series[series.length - 1]
  const prev = series[Math.max(0, series.length - 8)]
  if (last === undefined || prev === undefined) return ''
  const matureDelta = last.mature - prev.mature
  const youngWidth = last.young

  if (data.state === 'plateau') {
    return `Mature growth has slowed to ${matureDelta} cards in the past week. A small bump in new cards could help.`
  }
  if (matureDelta >= 28) {
    return `${matureDelta} new mature cards this past week. The young layer (${withCommas(youngWidth)}) means more graduations are coming.`
  }
  return `${matureDelta} cards moved into mature this past week, with ${withCommas(youngWidth)} more close behind.`
}

// ── JLPT interpretation ───────────────────────────────────────────────────

export function buildJlptLine(data: ProgressData): string {
  const candidates = data.jlpt.filter((j) => j.owned < j.total && j.encountered > 0)
  if (candidates.length === 0) return 'JLPT coverage starts once cards are mapped to a level.'

  let closest = candidates[0]
  if (closest === undefined) return ''
  let bestScore = closest.owned / closest.total
  for (const j of candidates) {
    const score = j.owned / j.total
    if (score > bestScore) {
      closest = j
      bestScore = score
    }
  }
  if (closest === undefined) return ''
  return `Closest to finishing ${closest.level}. ${withCommas(closest.owned)} of ${withCommas(closest.total)} cards owned.`
}

// ── Consistency interpretation ────────────────────────────────────────────

export function buildConsistencyLine(data: ProgressData): string {
  const days = data.heatmap.length
  const active = data.heatmap.filter((d) => d.count > 0).length
  if (active === 0) return 'No reviews logged yet.'
  return `Practiced on ${active} of the last ${days} days, with a steady cadence over the year.`
}

// ── Summary interpretation ────────────────────────────────────────────────

export function buildSummaryLine(data: ProgressData): string {
  const { summary } = data
  const weekly = Math.round(summary.cardsAddedThisMonth / 4)
  if (data.state === 'limited') {
    return `Early days. Once a couple more weeks of practice land, the chart shapes below will tell the story.`
  }
  if (data.state === 'plateau') {
    return `Mature cards are growing slowly, around ${weekly} per week. Retention is steady at ${pct(summary.retention30d)}.`
  }
  if (data.state === 'declining') {
    return `Retention has slipped this month. The mature pile is still growing, but it's worth checking which cards are missing.`
  }
  return `Mature cards are growing at roughly ${weekly} per week. Retention has held inside its expected range for the past month.`
}

// ── Limited-data return-on-date ──────────────────────────────────────────

export function limitedReturnDate(firstReviewIso: string): string {
  const d = new Date(`${firstReviewIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + LIMITED_THRESHOLD_DAYS)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export { LIMITED_THRESHOLD_DAYS }
