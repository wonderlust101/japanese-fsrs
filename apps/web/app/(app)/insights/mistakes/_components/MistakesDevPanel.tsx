'use client'

import { useMemo, useState } from 'react'

import {
  buildCleanFixture,
  buildLeechHeavyFixture,
  buildManyFixture,
  buildNotEnoughFixture,
} from './mistakesFixtures'
import type { MistakesData } from './mistakesTypes'

export type MistakesFixtureKey =
  | 'off'
  | 'clean'
  | 'many'
  | 'leech-heavy'
  | 'not-enough'
  | 'loading'
  | 'error'

export interface MistakesDevState {
  fixtureData: MistakesData | null
  forcedState: 'loading' | 'error' | null
  panel:       React.ReactNode
}

const FIXTURES: ReadonlyArray<{ key: MistakesFixtureKey; label: string; description: string }> = [
  { key: 'off',         label: 'Off',          description: 'Live data — render the real mistakes view.' },
  { key: 'clean',       label: 'Clean',        description: 'No major mistakes; the kitsune empty state.' },
  { key: 'many',        label: 'Many mistakes', description: 'Full data with all five SectionCards populated.' },
  { key: 'leech-heavy', label: 'Leech-heavy',  description: '6+ leeches; the page nudges toward repair.' },
  { key: 'not-enough',  label: 'Not enough',   description: 'Under 50 reviews in the window; limited-data empty state.' },
  { key: 'loading',     label: 'Loading',      description: 'Show full-page skeletons.' },
  { key: 'error',       label: 'Error',        description: 'Show inline error alert.' },
]

/**
 * Dev-only state controller for the Mistakes page. Outside development
 * this returns null fixtures and no panel. Mirrors the Statistics /
 * Progress dev panel pattern exactly.
 */
export function useMistakesDevState(): MistakesDevState {
  const [fixture, setFixture] = useState<MistakesFixtureKey>('off')
  const isDev = process.env.NODE_ENV === 'development'

  const fixtureData = useMemo<MistakesData | null>(() => {
    if (!isDev) return null
    if (fixture === 'clean')       return buildCleanFixture()
    if (fixture === 'many')        return buildManyFixture()
    if (fixture === 'leech-heavy') return buildLeechHeavyFixture()
    if (fixture === 'not-enough')  return buildNotEnoughFixture()
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
  fixture:  MistakesFixtureKey
  onChange: (next: MistakesFixtureKey) => void
}

function DevPanel({ fixture, onChange }: DevPanelProps): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const active = FIXTURES.find((f) => f.key === fixture) ?? FIXTURES[0] ?? { label: 'Off' }

  return (
    <div
      role="region"
      aria-label="Mistakes page dev state panel"
      className="fixed bottom-4 left-4 z-40 w-[18.5rem] max-w-[calc(100vw-2rem)] rounded-[2px] border border-soft-hairline bg-warm-paper-raised shadow-[var(--shadow-card)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b border-soft-hairline px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
          Dev · Mistakes state
        </span>
        <span className="font-mono text-[0.6875rem] text-sumi-ink">
          {active.label}
        </span>
      </button>

      {open && (
        <div className="p-2.5">
          <fieldset className="space-y-1" aria-label="Mistakes fixtures">
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
                    name="mistakes-fixture"
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
