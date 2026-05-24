import type {
  ApiAnalyticsDashboard,
  ApiForecastDay,
  ApiHeatmapDay,
  ApiJlptGap,
  ApiLayoutAccuracy,
} from '@fsrs-japanese/shared-types'

// ── Public shape ─────────────────────────────────────────────────────────────

export type NoteKind = 'progress' | 'mistakes' | 'planning'
export type NoteTone = 'celebratory' | 'attention' | 'neutral'
export type RecommendationTone = 'attention' | 'pacing' | 'celebratory'
export type FigureKind = 'retention' | 'mistakes' | 'forecast'

/**
 * One unit of the report body. Each note carries its own copy, tone, and
 * (optionally) a figure spec. The page renders these in rank order with
 * different chrome per weight.
 */
export interface ReportNote {
  kind:        NoteKind
  tone:        NoteTone
  /** Section ornament — single kanji. */
  kanji:       string
  /** Small-caps eyebrow label. */
  label:       string
  /** Prose body. Emphasized fragments are wrapped in `*…*`. */
  body:        string
  /** Where the deep-link points. */
  deepLink:    { label: string; href: string }
  /** Severity 0–100 — used to rank. Higher = more important this week. */
  severity:    number
  /**
   * Figure to render when this note is the lead. `null` for compact notes.
   * The lead note always gets its assigned figure; medium and compact notes
   * never render one.
   */
  figure:      FigureKind | null
}

export interface ReportRecommendation {
  tone:    RecommendationTone
  kanji:   string
  /** One-line teacher-voice diagnosis. */
  headline: string
  /** Optional supporting sentence. */
  body?:    string
  /** Optional "do this next" CTA. Omitted for forward-looking states where
   *  there's nothing to start yet (e.g. tomorrow's load), so the callout
   *  stays a quiet statement rather than offering an action it can't fulfil. */
  action?:  { label: string; href: string }
}

export interface ReportHeadline {
  text: string
  tone: NoteTone | 'new-user'
}

export interface WeekWindow {
  /** ISO date of the most recent Monday <= today (local). */
  weekStart:   string
  /** ISO date of the Sunday that closes the current week. */
  weekEnd:     string
  /** ISO 8601 week number, 1–53. */
  weekNumber:  number
  /** Number of days inside the current week that have any activity. */
  activeDaysThisWeek: number
}

export interface WeeklyReport {
  window:         WeekWindow
  headline:       ReportHeadline
  recommendation: ReportRecommendation
  notes:          { lead: ReportNote; second: ReportNote; third: ReportNote }
  /** True when there isn't enough data to produce meaningful insights. */
  lowData:        boolean
}

export interface WeeklyReportInputs {
  heatmap:  ReadonlyArray<ApiHeatmapDay>
  accuracy: ReadonlyArray<ApiLayoutAccuracy>
  jlptGap:  ReadonlyArray<ApiJlptGap>
  forecast: ReadonlyArray<ApiForecastDay>
}

/** Days of activity across the full heatmap before any insights are meaningful. */
export const MIN_ACTIVE_DAYS_FOR_INSIGHTS = 3
const MIN_LAYOUT_REVIEWS = 10

// ── Inputs builder ───────────────────────────────────────────────────────────

export function buildWeeklyReportInputs(
  dashboard: ApiAnalyticsDashboard | undefined,
  forecast:  ReadonlyArray<ApiForecastDay> | undefined,
): WeeklyReportInputs {
  return {
    // Heatmap retention is 0–100 on the wire; the entire Overview module
    // (narrative thresholds in `meanRetention`/`deriveSignals` and the
    // `RetentionChart` percentage formatting) assumes a 0–1 fraction.
    // Normalize once here, at the live ingestion boundary, exactly as the
    // Statistics page does in `adapt-live.ts`. Dev fixtures already supply
    // fractions and bypass this builder, so they are unaffected.
    heatmap:  (dashboard?.heatmap.items ?? []).map((d) => ({
      ...d,
      retention: d.count > 0 ? d.retention / 100 : 0,
    })),
    accuracy: dashboard?.accuracy.items ?? [],
    jlptGap:  dashboard?.jlptGap.items  ?? [],
    forecast: forecast                  ?? [],
  }
}

// ── Date helpers (UTC-day arithmetic, learner-local-ISO compatible) ──────────

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return isoFromDate(d)
}

/** Returns 0=Mon … 6=Sun (ISO weekday minus 1). */
function isoWeekday(iso: string): number {
  const day = parseIsoDate(iso).getUTCDay()
  return (day + 6) % 7
}

/** ISO 8601 week number for the given date. */
function isoWeekNumber(iso: string): number {
  const d = parseIsoDate(iso)
  // Thursday in current week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7 || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function buildWeekWindow(todayIso: string, heatmap: ReadonlyArray<ApiHeatmapDay>): WeekWindow {
  const dow = isoWeekday(todayIso)
  const weekStart = addDays(todayIso, -dow)
  const weekEnd   = addDays(weekStart, 6)
  const inRange = (d: string): boolean => d >= weekStart && d <= weekEnd
  const activeDaysThisWeek = heatmap.filter((d) => inRange(d.date) && d.count > 0).length
  return {
    weekStart,
    weekEnd,
    weekNumber: isoWeekNumber(todayIso),
    activeDaysThisWeek,
  }
}

// ── Aggregations ─────────────────────────────────────────────────────────────

function sortByDateAsc<T extends { date: string }>(xs: ReadonlyArray<T>): T[] {
  return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1))
}

function activeDays(h: ReadonlyArray<ApiHeatmapDay>): number {
  return h.filter((d) => d.count > 0).length
}

function meanRetention(
  h: ReadonlyArray<ApiHeatmapDay>,
  windowSize: number,
  min: number,
): number | null {
  const recent = [...h]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .filter((d) => d.count > 0)
    .slice(0, windowSize)
  if (recent.length < min) return null
  return recent.reduce((acc, d) => acc + d.retention, 0) / recent.length
}

interface OverallAccuracy {
  total: number
  pct:   number
}

/**
 * Single overall-accuracy stat across every accuracy bucket the API
 * returns. The report sums the buckets and speaks about reviews uniformly,
 * since the product surfaces a single review mode rather than separate
 * modality concepts.
 */
function overallAccuracy(a: ReadonlyArray<ApiLayoutAccuracy>): OverallAccuracy | null {
  let total = 0
  let successful = 0
  for (const row of a) {
    total      += row.total
    successful += row.successful
  }
  if (total < MIN_LAYOUT_REVIEWS) return null
  return { total, pct: (successful / total) * 100 }
}

interface ForecastWindow {
  values:     number[]
  tomorrow:   number
  weekTotal:  number
  peak:       number
  backlogPct: number
}

function forecastWindow(forecast: ReadonlyArray<ApiForecastDay>): ForecastWindow {
  const sorted = sortByDateAsc(forecast).slice(0, 14)
  const values = sorted.map((d) => d.count)
  const tomorrow = values[1] ?? values[0] ?? 0
  const weekTotal = values.slice(0, 7).reduce((a, b) => a + b, 0)
  const peak = Math.max(0, ...values)
  const backlogTotal = sorted.slice(0, 7).reduce((a, d) => a + d.backlogCount, 0)
  const backlogPct = weekTotal > 0 ? backlogTotal / weekTotal : 0
  return { values, tomorrow, weekTotal, peak, backlogPct }
}

function loadCharacter(weekTotal: number): 'light' | 'steady' | 'heavy' {
  if (weekTotal < 60)  return 'light'
  if (weekTotal < 250) return 'steady'
  return 'heavy'
}

function loadPhrase(c: 'light' | 'steady' | 'heavy'): string {
  if (c === 'light')  return 'a light week'
  if (c === 'heavy')  return 'a heavier week than usual'
  return 'a steady week'
}

// ── Note builders ────────────────────────────────────────────────────────────

interface DerivedSignals {
  recent7:        number | null
  trailing30:     number | null
  retentionDelta: number | null
  accuracy:       OverallAccuracy | null
  forecast:       ForecastWindow
  reviewedTotal:  number
  activeDayCount: number
}

function deriveSignals(
  inputs: WeeklyReportInputs,
): DerivedSignals {
  const recent7    = meanRetention(inputs.heatmap, 7, 3)
  const trailing30 = meanRetention(inputs.heatmap, 30, 7)
  return {
    recent7,
    trailing30,
    retentionDelta: recent7 !== null && trailing30 !== null ? recent7 - trailing30 : null,
    accuracy:       overallAccuracy(inputs.accuracy),
    forecast:       forecastWindow(inputs.forecast),
    reviewedTotal:  inputs.heatmap.reduce((acc, d) => acc + d.count, 0),
    activeDayCount: activeDays(inputs.heatmap),
  }
}

function buildProgressNote(s: DerivedSignals): ReportNote {
  const base: Omit<ReportNote, 'tone' | 'body' | 'severity'> = {
    kind:     'progress',
    kanji:    '保',
    label:    'Retention',
    deepLink: { label: 'See the full curve', href: '/insights/progress' },
    figure:   'retention',
  }

  // Concerning drop.
  if (s.retentionDelta !== null && s.retentionDelta <= -0.08 && s.recent7 !== null) {
    const drop = Math.round(-s.retentionDelta * 100)
    const recentPct = Math.round(s.recent7 * 100)
    return {
      ...base,
      tone:     'attention',
      severity: 80,
      body: `Your retention has settled at *${recentPct}%* across the last seven active days — *${drop} points* below the trailing month. The slip is small but worth attending to before it widens.`,
    }
  }

  // Celebratory lift.
  if (s.retentionDelta !== null && s.retentionDelta >= 0.05 && s.recent7 !== null && s.recent7 >= 0.85) {
    const lift = Math.round(s.recent7 * 100)
    return {
      ...base,
      tone:     'celebratory',
      severity: 60,
      body: `Retention is holding at *${lift}%* this week — your strongest stretch in a month. Whatever rhythm you've found, keep it.`,
    }
  }

  // Steady stretch.
  if (s.recent7 !== null) {
    const recentPct = Math.round(s.recent7 * 100)
    if (s.trailing30 !== null) {
      const trailingPct = Math.round(s.trailing30 * 100)
      return {
        ...base,
        tone:     'neutral',
        severity: 30,
        body: `Retention sits at *${recentPct}%* this week, in line with your trailing month at ${trailingPct}%. Quiet and consistent.`,
      }
    }
    return {
      ...base,
      tone:     'neutral',
      severity: 25,
      body: `Retention is holding at *${recentPct}%* this week. The trailing month will fill in as the schedule compounds.`,
    }
  }

  // Not enough active days to read retention honestly.
  return {
    ...base,
    tone:     'neutral',
    severity: 10,
    body: `Retention will take shape after a few more active days. Until then, the curve stays quiet.`,
  }
}

function buildMistakesNote(s: DerivedSignals): ReportNote {
  const base: Omit<ReportNote, 'tone' | 'body' | 'severity'> = {
    kind:     'mistakes',
    kanji:    '弱',
    label:    "Where you're slipping",
    deepLink: { label: 'Open weak spots', href: '/weak-spots' },
    figure:   'mistakes',
  }

  const a = s.accuracy
  if (a === null) {
    return {
      ...base,
      tone:     'neutral',
      severity: 10,
      body: `Not enough reviews yet to read a pattern. It will take shape as you practice.`,
    }
  }

  const pct = Math.round(a.pct)

  if (pct < 65) {
    return {
      ...base,
      tone:     'attention',
      severity: 90,
      body: `Accuracy is *${pct}%* across ${a.total} reviews, so misses are running well over your 85% target. The chart marks each day that landed below the line; this is the most worthwhile place to spend a quiet ten minutes.`,
    }
  }
  if (pct < 75) {
    return {
      ...base,
      tone:     'attention',
      severity: 65,
      body: `Accuracy is *${pct}%* across ${a.total} reviews, a little over your 85% target. The days below the line in the chart are where a short repair pass would help most.`,
    }
  }
  if (pct < 85) {
    return {
      ...base,
      tone:     'neutral',
      severity: 30,
      body: `Accuracy is *${pct}%* across ${a.total} reviews, tracking close to your 85% target. Steady, with room to climb.`,
    }
  }
  return {
    ...base,
    tone:     'celebratory',
    severity: 15,
    body: `Accuracy is *${pct}%* across ${a.total} reviews. The chart tracks each day's misses against your 85% target; the collection is healthy.`,
  }
}

function buildPlanningNote(s: DerivedSignals): ReportNote {
  const base: Omit<ReportNote, 'tone' | 'body' | 'severity'> = {
    kind:     'planning',
    kanji:    '次',
    label:    'The week ahead',
    deepLink: { label: 'See your forecast', href: '/insights/forecast' },
    figure:   'forecast',
  }

  const { weekTotal, tomorrow, peak, backlogPct } = s.forecast
  const character = loadCharacter(weekTotal)
  const phrase = loadPhrase(character)

  if (backlogPct >= 0.25 && weekTotal > 0) {
    return {
      ...base,
      tone:     'attention',
      severity: 70,
      body: `*${Math.round(backlogPct * 100)}% of next week's load is backlog.* The forecast is dominated by overdue cards — clearing them first will make the rest feel lighter.`,
    }
  }
  if (character === 'heavy') {
    return {
      ...base,
      tone:     'attention',
      severity: 55,
      body: `Next week looks like *${phrase}* — *${weekTotal} cards* scheduled, peaking at *${peak}* on one day. Consider easing the new-card pace until the queue settles.`,
    }
  }
  if (character === 'light') {
    return {
      ...base,
      tone:     'celebratory',
      severity: 25,
      body: `Next week is *${phrase}* — *${weekTotal} cards* total, *${tomorrow}* tomorrow. Room to add new material if you'd like.`,
    }
  }
  return {
    ...base,
    tone:     'neutral',
    severity: 30,
    body: `Next week looks *${phrase}* — *${weekTotal} cards* scheduled, *${tomorrow}* tomorrow. Nothing to rearrange.`,
  }
}

// ── Recommendation builder ───────────────────────────────────────────────────

function buildRecommendation(lead: ReportNote, s: DerivedSignals): ReportRecommendation {
  if (lead.kind === 'mistakes' && lead.tone === 'attention') {
    return {
      tone:     'attention',
      kanji:    '要',
      headline: 'Spend ten quiet minutes on your slipping cards.',
      body:     'A focused repair pass on what you\'re missing now lifts the whole average.',
      action:   { label: 'Drill weak spots', href: '/weak-spots' },
    }
  }
  if (lead.kind === 'progress' && lead.tone === 'attention') {
    return {
      tone:     'attention',
      kanji:    '要',
      headline: 'Run today\'s review before adding anything new.',
      body:     'When retention slips, the kindest move is to attend to what\'s already on the schedule.',
      action:   { label: 'Start today\'s review', href: '/today' },
    }
  }
  if (lead.kind === 'planning' && lead.tone === 'attention') {
    return {
      tone:     'attention',
      kanji:    '整',
      headline: 'Clear the backlog before tomorrow\'s new cards.',
      body:     'A short catch-up session today keeps the week from compounding.',
      action:   { label: 'Start a short session', href: '/today' },
    }
  }
  if (lead.tone === 'celebratory') {
    return {
      tone:     'celebratory',
      kanji:    '続',
      headline: 'Keep the rhythm. Tomorrow looks like a manageable day.',
    }
  }
  return {
    tone:     'pacing',
    kanji:    '今',
    headline: `Tomorrow's review is ${s.forecast.tomorrow} card${s.forecast.tomorrow === 1 ? '' : 's'} — a steady start.`,
  }
}

// ── Headline builder ─────────────────────────────────────────────────────────

function pickByDate<T>(seed: string, pool: ReadonlyArray<T>, fallback: T): T {
  if (pool.length === 0) return fallback
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return pool[hash % pool.length] ?? fallback
}

function buildHeadline(lead: ReportNote, s: DerivedSignals, seed: string): ReportHeadline {
  if (lead.kind === 'progress' && lead.tone === 'attention' && s.retentionDelta !== null) {
    const drop = Math.round(-s.retentionDelta * 100)
    return {
      tone: 'attention',
      text: `Your retention slipped by *${drop} points* this week — small, but worth a closer look.`,
    }
  }
  if (lead.kind === 'progress' && lead.tone === 'celebratory' && s.recent7 !== null) {
    const lift = Math.round(s.recent7 * 100)
    return {
      tone: 'celebratory',
      text: `Retention is holding at *${lift}%* this week — your strongest stretch in a month.`,
    }
  }
  if (lead.kind === 'mistakes' && lead.tone === 'attention' && s.accuracy !== null) {
    const pct = Math.round(s.accuracy.pct)
    return {
      tone: 'attention',
      text: `Your reviews are landing at *${pct}%* — your softest stretch in a while.`,
    }
  }
  if (lead.kind === 'planning' && lead.tone === 'attention') {
    return {
      tone: 'attention',
      text: `Next week is *${loadPhrase(loadCharacter(s.forecast.weekTotal))}* — *${s.forecast.weekTotal} cards* scheduled.`,
    }
  }
  // Neutral / celebratory date-rotated fallbacks.
  const lines: ReadonlyArray<string> = [
    `*${s.activeDayCount} sessions* in the books. The schedule keeps moving while you do.`,
    `Steady week: *${s.reviewedTotal} cards reviewed*, and the rhythm shows.`,
    `*${s.reviewedTotal} cards* across ${s.activeDayCount} active days — the compounding is quiet.`,
  ]
  return { tone: 'neutral', text: pickByDate(seed, lines, lines[0] as string) }
}

// ── The full builder ─────────────────────────────────────────────────────────

/**
 * Build the full weekly report. Pure function — same inputs + seed always
 * produce the same report, so tests and previews can pin the output.
 *
 * `todayIso` is the learner-local YYYY-MM-DD for "today"; `seed` is used to
 * date-rotate neutral copy on ties.
 */
export function buildWeeklyReport(
  inputs:   WeeklyReportInputs,
  todayIso: string,
  seed:     string = todayIso,
): WeeklyReport {
  const window = buildWeekWindow(todayIso, inputs.heatmap)
  const signals = deriveSignals(inputs)
  const lowData = signals.activeDayCount < MIN_ACTIVE_DAYS_FOR_INSIGHTS

  if (lowData) {
    const startNote: ReportNote = {
      kind:     'progress',
      tone:     'neutral',
      kanji:    '始',
      label:    'Just starting',
      severity: 0,
      figure:   null,
      body:
        'Your report will arrive after three or four sessions. Until then, the patterns are too thin to read honestly.',
      deepLink: { label: 'Start your first review', href: '/today' },
    }
    const placeholderMistakes: ReportNote = {
      kind:     'mistakes',
      tone:     'neutral',
      kanji:    '弱',
      label:    'Mistake patterns',
      severity: 0,
      figure:   null,
      body:     'Mistake patterns surface once you have a handful of reviews behind you.',
      deepLink: { label: 'Open weak spots', href: '/weak-spots' },
    }
    const placeholderPlanning: ReportNote = {
      kind:     'planning',
      tone:     'neutral',
      kanji:    '次',
      label:    'The week ahead',
      severity: 0,
      figure:   null,
      body:     'A forecast appears once a few cards are scheduled forward.',
      deepLink: { label: 'Open forecast', href: '/insights/forecast' },
    }
    return {
      window,
      headline: {
        tone: 'new-user',
        text: 'Insights need a few sessions to find their shape. *Three or four more* will do it.',
      },
      recommendation: {
        tone:     'pacing',
        kanji:    '始',
        headline: 'Run your first review to start the report.',
        action:   { label: 'Start a review', href: '/today' },
      },
      notes: { lead: startNote, second: placeholderMistakes, third: placeholderPlanning },
      lowData: true,
    }
  }

  const progress = buildProgressNote(signals)
  const mistakes = buildMistakesNote(signals)
  const planning = buildPlanningNote(signals)

  // The three notes always render in the same slots — progress leads, mistakes
  // sits in the medium slot, planning closes in the compact slot — so the
  // sections never swap positions between loads. Severity is used only to pick
  // which note steers the headline and recommendation copy at the top of the
  // page (a single fixed-position element), not to reorder the cards below.
  const mostSevere = [progress, mistakes, planning].sort((a, b) => {
    if (a.severity !== b.severity) return b.severity - a.severity
    // Deterministic tiebreak: progress > mistakes > planning when severities tie.
    const order: Record<NoteKind, number> = { progress: 0, mistakes: 1, planning: 2 }
    return order[a.kind] - order[b.kind]
  })[0] as ReportNote

  return {
    window,
    headline:       buildHeadline(mostSevere, signals, seed),
    recommendation: buildRecommendation(mostSevere, signals),
    notes:          { lead: progress, second: mistakes, third: planning },
    lowData:        false,
  }
}

// ── Emphasis splitter (re-exported from former headline-insight.ts) ──────────

/**
 * Splits a body string into alternating plain / emphasized chunks at the
 * `*…*` markers. The renderer styles the emphasized chunks distinctly
 * (vermillion in attention/celebratory contexts, sumi in neutral).
 */
export function splitEmphasis(text: string): Array<{ kind: 'plain' | 'em'; text: string }> {
  const parts: Array<{ kind: 'plain' | 'em'; text: string }> = []
  let cursor = 0
  const re = /\*([^*]+)\*/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) parts.push({ kind: 'plain', text: text.slice(cursor, match.index) })
    parts.push({ kind: 'em', text: match[1] ?? '' })
    cursor = re.lastIndex
  }
  if (cursor < text.length) parts.push({ kind: 'plain', text: text.slice(cursor) })
  return parts
}
