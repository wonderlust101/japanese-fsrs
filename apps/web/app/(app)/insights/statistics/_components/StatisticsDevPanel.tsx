'use client'

import { useMemo, useState } from 'react'

import {
  buildFullFixture,
  buildHeavyBacklogFixture,
  buildLimitedFixture,
  buildNoFsrsFixture,
} from './fixtures'
import type { StatisticsData } from './types'

export type StatisticsFixtureKey =
  | 'off'
  | 'full'
  | 'limited'
  | 'heavy-backlog'
  | 'no-fsrs'
  | 'loading'
  | 'error'

export interface StatisticsDevState {
  /** Fixture-derived statistics data, or null to use live data. */
  fixtureData: StatisticsData | null
  /** Force a loading / error state regardless of live query state. */
  forcedState: 'loading' | 'error' | null
  /** Dev-only floating panel. Null outside development. */
  panel:       React.ReactNode
}

const FIXTURES: { key: StatisticsFixtureKey; label: string; description: string }[] = [
  { key: 'off',           label: 'Off',             description: 'Live data — render the real statistics.' },
  { key: 'full',          label: 'Full data',       description: 'Mid-progress N3 learner, 365 days of activity, FSRS optimized.' },
  { key: 'limited',       label: 'Limited data',    description: 'New user, 2 weeks of activity, FSRS never run.' },
  { key: 'heavy-backlog', label: 'Heavy backlog',   description: '84 overdue cards, FSRS optimization pending.' },
  { key: 'no-fsrs',       label: 'No FSRS yet',     description: 'Full activity but FSRS hasn\'t been optimized.' },
  { key: 'loading',       label: 'Loading',         description: 'Show full-page skeletons.' },
  { key: 'error',         label: 'Error',           description: 'Show inline error alert.' },
]

/**
 * Dev-only state controller for the Statistics page. Outside development
 * this returns `{ fixtureData: null, panel: null, ... }` as a no-op. In
 * development it renders a fixed bottom-left panel cycling through every
 * documented state of the page without leaving the route.
 */
export function useStatisticsDevState(): StatisticsDevState {
  const [fixture, setFixture] = useState<StatisticsFixtureKey>('off')
  const isDev = process.env.NODE_ENV === 'development'

  const fixtureData = useMemo<StatisticsData | null>(() => {
    if (!isDev) return null
    if (fixture === 'full')          return buildFullFixture()
    if (fixture === 'limited')       return buildLimitedFixture()
    if (fixture === 'heavy-backlog') return buildHeavyBacklogFixture()
    if (fixture === 'no-fsrs')       return buildNoFsrsFixture()
    return null
  }, [isDev, fixture])

  const forcedState: 'loading' | 'error' | null =
    !isDev ? null
    : fixture === 'loading' ? 'loading'
    : fixture === 'error'   ? 'error'
    : null

  return {
    fixtureData,
    forcedState,
    panel: isDev ? <DevPanel fixture={fixture} onChange={setFixture} /> : null,
  }
}

function DevPanel({
  fixture,
  onChange,
}: {
  fixture:  StatisticsFixtureKey
  onChange: (next: StatisticsFixtureKey) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Off' }

  return (
    <div
      role="region"
      aria-label="Statistics page dev state panel"
      className="fixed bottom-4 left-4 z-40 w-[18.5rem] max-w-[calc(100vw-2rem)] rounded-[2px] border border-soft-hairline bg-warm-paper-raised shadow-[var(--shadow-card)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b border-soft-hairline px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
          Dev · Statistics state
        </span>
        <span className="font-mono text-[0.6875rem] text-sumi-ink">
          {active.label}
        </span>
      </button>

      {open && (
        <div className="p-2.5">
          <fieldset className="space-y-1" aria-label="Statistics fixtures">
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
                    name="statistics-fixture"
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
