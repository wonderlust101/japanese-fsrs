'use client'

import { useMemo, useState } from 'react'

import type {
  ApiForecastDay,
  ApiHeatmapDay,
  ApiJlptGap,
  ApiLayoutAccuracy,
} from '@fsrs-japanese/shared-types'

import type { WeeklyReportInputs } from './weekly-report'

// ── Public hook ──────────────────────────────────────────────────────────────

export type InsightsFixtureKey =
  | 'off'
  | 'attention'
  | 'calm'
  | 'low-data'
  | 'loading'
  | 'error'

export interface InsightsDevState {
  /** Fixture-derived report inputs, or null to use live data. */
  fixtureInputs: WeeklyReportInputs | null
  /** Pinned today date for the fixture, or null to use real today. */
  todayIso:      string | null
  /** Seed for date-rotated copy, or null to use today. */
  seed:          string | null
  /** Force a loading or error state regardless of live query state. */
  forcedState:   'loading' | 'error' | null
  /** Dev-only floating panel. Null outside development. */
  panel:         React.ReactNode
}

const FIXTURE_TODAY = '2026-05-16'

const FIXTURES: { key: InsightsFixtureKey; label: string; description: string }[] = [
  { key: 'off',       label: 'Off',                 description: 'Live data — render the real report.' },
  { key: 'attention', label: 'Attention week',      description: 'Accuracy has slipped to 72%. Mistakes leads.' },
  { key: 'calm',      label: 'Celebratory week',    description: 'Retention stepped up to 91%. Progress leads.' },
  { key: 'low-data',  label: 'New user · low data', description: 'Two active days. Empty state with kitsune.' },
  { key: 'loading',   label: 'Loading skeleton',    description: 'Show the full-page skeleton.' },
  { key: 'error',     label: 'Error state',         description: 'Show the inline error alert.' },
]

/**
 * Dev-only state controller for the Insights Overview. Outside development
 * this returns `{ fixtureInputs: null, panel: null, … }` and is a no-op.
 * Inside development it renders a fixed bottom-left panel that cycles the
 * page through every documented state without leaving the route.
 */
export function useInsightsDevState(): InsightsDevState {
  const [fixture, setFixture] = useState<InsightsFixtureKey>('off')
  const isDev = process.env.NODE_ENV === 'development'

  const fixtureInputs = useMemo<WeeklyReportInputs | null>(() => {
    if (!isDev) return null
    if (fixture === 'attention') return buildAttentionWeekInputs(FIXTURE_TODAY)
    if (fixture === 'calm')      return buildCalmWeekInputs(FIXTURE_TODAY)
    if (fixture === 'low-data')  return buildLowDataInputs(FIXTURE_TODAY)
    return null
  }, [isDev, fixture])

  const forcedState: 'loading' | 'error' | null =
    !isDev ? null
    : fixture === 'loading' ? 'loading'
    : fixture === 'error'   ? 'error'
    : null

  const todayIso = fixtureInputs !== null ? FIXTURE_TODAY : null
  const seed     = fixtureInputs !== null ? fixture       : null

  return {
    fixtureInputs,
    todayIso,
    seed,
    forcedState,
    panel: isDev ? <InsightsDevPanel fixture={fixture} onChange={setFixture} /> : null,
  }
}

// ── Panel UI ─────────────────────────────────────────────────────────────────

interface InsightsDevPanelProps {
  fixture:  InsightsFixtureKey
  onChange: (next: InsightsFixtureKey) => void
}

export function InsightsDevPanel({
  fixture,
  onChange,
}: InsightsDevPanelProps): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Off' }

  return (
    <div
      role="region"
      aria-label="Insights page dev state panel"
      className="fixed bottom-4 left-4 z-40 w-[18.5rem] max-w-[calc(100vw-2rem)] rounded-[2px] border border-soft-hairline bg-warm-paper-raised shadow-[var(--shadow-card)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b border-soft-hairline px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
          Dev · Insights state
        </span>
        <span className="font-mono text-[0.6875rem] text-sumi-ink">
          {active.label}
        </span>
      </button>

      {open && (
        <div className="p-2.5">
          <fieldset className="space-y-1" aria-label="Insights fixtures">
            {FIXTURES.map((f) => {
              const checked = f.key === fixture
              return (
                <label
                  key={f.key}
                  className={[
                    'flex cursor-pointer items-start gap-2 rounded-[2px] border px-2.5 py-1.5 text-xs transition-colors',
                    checked
                      ? 'border-inari-vermillion bg-inari-vermillion/5'
                      : 'border-transparent hover:border-soft-hairline hover:bg-cream-inset/45',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="insights-fixture"
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
          <p className="mt-2 px-1 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-faded-sumi/80">
            Fixture today · {FIXTURE_TODAY}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Fixtures (relocated from /app/dev/insights-overview/fixtures.ts) ─────────

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function generateHeatmap(
  todayIso: string,
  days:     number,
  shape:    (i: number) => { retention: number; count: number },
): ApiHeatmapDay[] {
  const out: ApiHeatmapDay[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(todayIso, -i)
    const { retention, count } = shape(i)
    out.push({ date, retention, count })
  }
  return out
}

function generateForecast(
  todayIso: string,
  days:     number,
  shape:    (i: number) => { newCount: number; reviewCount: number; backlogCount: number },
): ApiForecastDay[] {
  const out: ApiForecastDay[] = []
  for (let i = 0; i < days; i += 1) {
    const date = addDays(todayIso, i)
    const { newCount, reviewCount, backlogCount } = shape(i)
    out.push({
      date,
      count:        newCount + reviewCount + backlogCount,
      newCount,
      reviewCount,
      backlogCount,
    })
  }
  return out
}

/** Attention week: overall accuracy is weak; Mistakes leads. */
function buildAttentionWeekInputs(todayIso: string): WeeklyReportInputs {
  const heatmap: ApiHeatmapDay[] = generateHeatmap(todayIso, 30, (i) => {
    const seed = (i * 53) % 7
    const ret  = 0.72 + (seed - 3) * 0.03
    const count = i % 5 === 0 ? 0 : 18 + (i % 4) * 3
    return { retention: ret, count }
  })

  const accuracy: ApiLayoutAccuracy[] = [
    { layout: 'comprehension', total: 302, successful: 218, accuracyPct: 72 },
  ]

  const jlptGap: ApiJlptGap[] = [
    { jlptLevel: 'N5', total: 800,  learned: 768, due: 24, progressPct: 96 },
    { jlptLevel: 'N4', total: 600,  learned: 480, due: 18, progressPct: 80 },
    { jlptLevel: 'N3', total: 1850, learned: 612, due: 32, progressPct: 33 },
  ]

  const forecast: ApiForecastDay[] = generateForecast(todayIso, 14, (i) => ({
    newCount:     i < 7 ? 12 : 10,
    reviewCount:  i < 7 ? 28 + (i % 3) * 4 : 22,
    backlogCount: 0,
  }))

  return { heatmap, accuracy, jlptGap, forecast }
}

/** Celebratory week: retention up; Progress leads. */
function buildCalmWeekInputs(todayIso: string): WeeklyReportInputs {
  const heatmap: ApiHeatmapDay[] = generateHeatmap(todayIso, 30, (i) => {
    const isRecent = i < 7
    const baseline = isRecent ? 0.91 : 0.81
    const seed     = (i * 41) % 5
    const ret      = baseline + (seed - 2) * 0.010
    const count    = isRecent ? 26 + (i % 4) * 4 : i % 5 === 0 ? 0 : 22 + (i % 4) * 3
    return { retention: ret, count }
  })

  const accuracy: ApiLayoutAccuracy[] = [
    { layout: 'comprehension', total: 510, successful: 458, accuracyPct: 90 },
  ]

  const jlptGap: ApiJlptGap[] = [
    { jlptLevel: 'N5', total: 800,  learned: 800, due: 0,  progressPct: 100 },
    { jlptLevel: 'N4', total: 600,  learned: 540, due: 14, progressPct: 90 },
    { jlptLevel: 'N3', total: 1850, learned: 860, due: 26, progressPct: 46 },
  ]

  const forecast: ApiForecastDay[] = generateForecast(todayIso, 14, (i) => ({
    newCount:     8,
    reviewCount:  18 + (i % 4) * 2,
    backlogCount: 0,
  }))

  return { heatmap, accuracy, jlptGap, forecast }
}

/** New user with only two active days. Drives the empty state. */
function buildLowDataInputs(todayIso: string): WeeklyReportInputs {
  const heatmap: ApiHeatmapDay[] = generateHeatmap(todayIso, 14, (i) => {
    if (i >= 12) return { retention: 0.78, count: 12 }
    return { retention: 0, count: 0 }
  })

  const accuracy: ApiLayoutAccuracy[] = [
    { layout: 'comprehension', total: 14, successful: 11, accuracyPct: 79 },
  ]

  const jlptGap: ApiJlptGap[] = [
    { jlptLevel: 'N5', total: 800, learned: 12, due: 8, progressPct: 1 },
  ]

  const forecast: ApiForecastDay[] = generateForecast(todayIso, 14, (i) => ({
    newCount:     i < 5 ? 5 : 0,
    reviewCount:  i < 5 ? 4 : 0,
    backlogCount: 0,
  }))

  return { heatmap, accuracy, jlptGap, forecast }
}
