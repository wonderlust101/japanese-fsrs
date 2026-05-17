'use client'

import { useEffect, useId, useState } from 'react'

import { useDecks } from '@/lib/api/decks'

import type { MistakesFilters, MistakesTimeRange } from './mistakesTypes'

interface MistakesFilterRowProps {
  value:    MistakesFilters
  onChange: (next: MistakesFilters) => void
}

const TIME_RANGES: ReadonlyArray<{ key: MistakesTimeRange; label: string }> = [
  { key: '7d',  label: '7d'  },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'All' },
]

const STORAGE_KEY = 'mistakes:filters'

/**
 * Load filters from localStorage on mount. Returns a callable hook so
 * the parent can hydrate state once on the client, avoiding SSR
 * hydration mismatch.
 */
export function useMistakesFiltersStorage(initial: MistakesFilters): [
  MistakesFilters,
  (next: MistakesFilters) => void,
] {
  const [filters, setFilters] = useState<MistakesFilters>(initial)

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === null) return
      const parsed = JSON.parse(raw) as Partial<MistakesFilters>
      if (
        typeof parsed.deckId === 'string' &&
        typeof parsed.timeRange === 'string' &&
        (['7d', '30d', '90d', 'all'] as const).includes(parsed.timeRange as MistakesTimeRange)
      ) {
        setFilters({
          deckId:    parsed.deckId,
          timeRange: parsed.timeRange as MistakesTimeRange,
        })
      }
    } catch {
      // Ignore — fallback to the initial value.
    }
  }, [])

  const update = (next: MistakesFilters): void => {
    setFilters(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore — quota or privacy mode; non-blocking.
    }
  }

  return [filters, update]
}

/**
 * Filter row for the Mistakes page. Two controls: a Deck dropdown (All
 * decks plus the user's own) and a Time range pill row (7d / 30d / 90d
 * / All, default 30d). Both drive every section on the page through
 * the parent's onChange handler.
 *
 * Layout: single horizontal row at sm+, stacks to two rows below.
 */
export function MistakesFilterRow({ value, onChange }: MistakesFilterRowProps): React.JSX.Element {
  const decksQuery = useDecks(50)
  const decks = decksQuery.data?.items ?? []
  const deckSelectId = useId()

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-soft-hairline pb-5">
      {/* Deck dropdown */}
      <div className="flex items-center gap-x-2">
        <label
          htmlFor={deckSelectId}
          className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi"
        >
          Deck
        </label>
        <select
          id={deckSelectId}
          value={value.deckId}
          onChange={(e) => onChange({ ...value, deckId: e.currentTarget.value })}
          className="rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          <option value="all">All decks</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Time range pills */}
      <div
        role="tablist"
        aria-label="Time range"
        className="flex items-center gap-0.5 rounded-[2px] border border-soft-hairline bg-cream-inset/40 p-0.5"
      >
        {TIME_RANGES.map((r) => {
          const active = r.key === value.timeRange
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ ...value, timeRange: r.key })}
              className={[
                'rounded-[2px] px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                active
                  ? 'bg-sumi-ink text-warm-paper-base'
                  : 'text-faded-sumi hover:text-sumi-ink',
              ].join(' ')}
            >
              {r.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
