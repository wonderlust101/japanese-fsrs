'use client'

import { useMemo, useState } from 'react'

import { FixtureOption, FixtureOptionList, FixturePanel } from '@/components/dev/FixturePanel'

import {
  buildFullFixture,
  buildHeavyBacklogFixture,
  buildLimitedFixture,
} from './fixtures'
import type { StatisticsData } from './types'

export type StatisticsFixtureKey =
  | 'off'
  | 'full'
  | 'limited'
  | 'heavy-backlog'
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
  { key: 'full',          label: 'Full data',       description: 'Mid-progress N3 learner, 365 days of activity.' },
  { key: 'limited',       label: 'Limited data',    description: 'New user, 2 weeks of activity.' },
  { key: 'heavy-backlog', label: 'Heavy backlog',   description: '84 overdue cards.' },
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
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Off' }

  return (
    <FixturePanel
      title="Dev · Statistics state"
      summary={active.label}
      ariaLabel="Statistics page dev state panel"
    >
      <FixtureOptionList ariaLabel="Statistics fixtures">
        {FIXTURES.map((f) => (
          <FixtureOption
            key={f.key}
            name="statistics-fixture"
            value={f.key}
            checked={f.key === fixture}
            onChange={() => onChange(f.key)}
            label={f.label}
            description={f.description}
          />
        ))}
      </FixtureOptionList>
    </FixturePanel>
  )
}
