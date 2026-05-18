'use client'

import { useMemo, useState } from 'react'

import { FixtureOption, FixtureOptionList, FixturePanel } from '@/components/dev/FixturePanel'

import {
  buildDecliningFixture,
  buildLimitedFixture,
  buildPlateauFixture,
  buildStrongFixture,
} from './progressFixtures'
import type { ProgressData } from './progressTypes'

export type ProgressFixtureKey =
  | 'off'
  | 'strong'
  | 'plateau'
  | 'declining'
  | 'limited'
  | 'loading'
  | 'error'

export interface ProgressDevState {
  /** Fixture-derived progress data, or null to use live data / show empty. */
  fixtureData: ProgressData | null
  /** Force a loading / error state regardless of live query state. */
  forcedState: 'loading' | 'error' | null
  /** Dev-only floating panel. Null outside development. */
  panel:       React.ReactNode
}

const FIXTURES: ReadonlyArray<{ key: ProgressFixtureKey; label: string; description: string }> = [
  { key: 'off',       label: 'Off',         description: 'Live data — render the real progress view.' },
  { key: 'strong',    label: 'Strong',      description: 'Memory holding, mature pile growing on schedule.' },
  { key: 'plateau',   label: 'Plateau',     description: 'Retention steady, mature growth flat for 30d.' },
  { key: 'declining', label: 'Declining',   description: 'Retention has dropped 4–8 points over the past 3 weeks.' },
  { key: 'limited',   label: 'Limited',     description: 'Under 14 days of history — shows the empty state.' },
  { key: 'loading',   label: 'Loading',     description: 'Show full-page skeletons.' },
  { key: 'error',     label: 'Error',       description: 'Show inline error alert.' },
]

/**
 * Dev-only state controller for the Progress page. Outside development
 * this returns `{ fixtureData: null, panel: null, ... }` as a no-op. In
 * development it renders a fixed bottom-left panel cycling through every
 * documented state of the page without leaving the route.
 *
 * Mirrors the Statistics dev panel exactly so muscle memory transfers.
 */
export function useProgressDevState(): ProgressDevState {
  const [fixture, setFixture] = useState<ProgressFixtureKey>('off')
  const isDev = process.env.NODE_ENV === 'development'

  const fixtureData = useMemo<ProgressData | null>(() => {
    if (!isDev) return null
    if (fixture === 'strong')    return buildStrongFixture()
    if (fixture === 'plateau')   return buildPlateauFixture()
    if (fixture === 'declining') return buildDecliningFixture()
    if (fixture === 'limited')   return buildLimitedFixture()
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

interface DevPanelProps {
  fixture:  ProgressFixtureKey
  onChange: (next: ProgressFixtureKey) => void
}

function DevPanel({ fixture, onChange }: DevPanelProps): React.JSX.Element {
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Off' }

  return (
    <FixturePanel
      title="Dev · Progress state"
      summary={active.label}
      ariaLabel="Progress page dev state panel"
    >
      <FixtureOptionList ariaLabel="Progress fixtures">
        {FIXTURES.map((f) => (
          <FixtureOption
            key={f.key}
            name="progress-fixture"
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
