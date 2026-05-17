'use client'

import { useMemo, useState } from 'react'

import { FixtureOption, FixtureOptionList, FixturePanel } from '@/components/dev/FixturePanel'
import type { ApiLeechListResponse } from '@fsrs-japanese/shared-types'

import {
  buildCleanFixture,
  buildFewFixture,
  buildManyFixture,
  buildOrphanFixture,
  buildResolvedFixture,
} from './leechesFixtures'

export type LeechesFixtureKey =
  | 'off'
  | 'clean'
  | 'few'
  | 'many'
  | 'resolved'
  | 'orphan'
  | 'loading'
  | 'error'

export interface LeechesDevState {
  fixtureData: ApiLeechListResponse | null
  forcedState: 'loading' | 'error' | null
  panel:       React.ReactNode
}

const FIXTURES: ReadonlyArray<{
  key:         LeechesFixtureKey
  label:       string
  description: string
}> = [
  { key: 'off',      label: 'Off',         description: 'Live data — render the real leech list.' },
  { key: 'clean',    label: 'Clean',       description: 'No leeches in the current window; empty state.' },
  { key: 'few',      label: 'A few',       description: 'Three leeches across two decks.' },
  { key: 'many',     label: 'Many',        description: 'Seven leeches with a mix of modalities and diagnoses.' },
  { key: 'resolved', label: 'Resolved',    description: 'Resolved-status fixture — Reopen affordance visible.' },
  { key: 'orphan',   label: 'Orphan',      description: 'Cards deleted post-detection; minimal row anatomy.' },
  { key: 'loading',  label: 'Loading',     description: 'Show the skeleton list.' },
  { key: 'error',    label: 'Error',       description: 'Show the inline error alert.' },
]

/**
 * Dev-only state controller for the leeches page. In production this returns
 * `{ fixtureData: null, forcedState: null, panel: null }` and the page reads
 * from `useLeechesQuery` exclusively. Pattern mirrors `useMistakesDevState`.
 */
export function useLeechesDevState(): LeechesDevState {
  const [fixture, setFixture] = useState<LeechesFixtureKey>('off')
  const isDev = process.env.NODE_ENV === 'development'

  const fixtureData = useMemo<ApiLeechListResponse | null>(() => {
    if (!isDev) return null
    if (fixture === 'clean')    return buildCleanFixture()
    if (fixture === 'few')      return buildFewFixture()
    if (fixture === 'many')     return buildManyFixture()
    if (fixture === 'resolved') return buildResolvedFixture()
    if (fixture === 'orphan')   return buildOrphanFixture()
    return null
  }, [isDev, fixture])

  const forcedState: 'loading' | 'error' | null = !isDev
    ? null
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
  fixture:  LeechesFixtureKey
  onChange: (next: LeechesFixtureKey) => void
}

function DevPanel({ fixture, onChange }: DevPanelProps): React.JSX.Element {
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Off' }

  return (
    <FixturePanel
      title="Dev · Leeches state"
      summary={active.label}
      ariaLabel="Leeches page dev state panel"
    >
      <FixtureOptionList ariaLabel="Leech fixtures">
        {FIXTURES.map((f) => (
          <FixtureOption
            key={f.key}
            name="leeches-fixture"
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
