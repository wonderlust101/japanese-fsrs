'use client'

import { useEffect, useId, useState } from 'react'

import { useDecks } from '@/lib/api/decks'
import type {
  LeechDiagnosisFilter,
  LeechSortOrder,
  LeechStatusFilter,
} from '@/lib/actions/leeches.actions'

import type { LeechFilters } from './leeches-types'

interface LeechesFilterRowProps {
  value:    LeechFilters
  onChange: (next: LeechFilters) => void
}

const STORAGE_KEY = 'leeches:filters'

const STATUS_OPTIONS: ReadonlyArray<{ key: LeechStatusFilter; label: string }> = [
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'resolved',   label: 'Resolved'   },
]

const SORT_OPTIONS: ReadonlyArray<{ key: LeechSortOrder; label: string }> = [
  { key: 'mostRecent',       label: 'Most recent'       },
  { key: 'oldestUnresolved', label: 'Oldest unresolved' },
  { key: 'mostLapses',       label: 'Most lapses'       },
  { key: 'deckOrder',        label: 'Deck order'        },
]

const JLPT_OPTIONS: ReadonlyArray<string> = ['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt']
const JLPT_LABEL: Record<string, string> = {
  N5:           'N5',
  N4:           'N4',
  N3:           'N3',
  N2:           'N2',
  N1:           'N1',
  beyond_jlpt:  'Beyond',
}

const CARD_TYPE_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'comprehension', label: 'Comprehension' },
  { key: 'production',    label: 'Production'    },
  { key: 'listening',     label: 'Listening'     },
]

const DIAGNOSIS_OPTIONS: ReadonlyArray<{ key: LeechDiagnosisFilter | 'all'; label: string }> = [
  { key: 'all',       label: 'Any'        },
  { key: 'available', label: 'Diagnosed'  },
  { key: 'missing',   label: 'Undiagnosed'},
]

/**
 * LocalStorage hook for leech filters. Hydrates on mount (client only) so
 * SSR rendering matches the server's initial state; subsequent updates
 * persist on every onChange. Mirrors `useMistakesFiltersStorage`.
 *
 * Defensive parsing: rejects any payload whose primitives aren't string,
 * because a hand-edited or corrupted localStorage value could otherwise
 * crash the filter row mid-render.
 */
export function useLeechFiltersStorage(initial: LeechFilters): [
  LeechFilters,
  (next: LeechFilters) => void,
] {
  const [filters, setFilters] = useState<LeechFilters>(initial)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === null) return
      const parsed = JSON.parse(raw) as Partial<LeechFilters>
      const hydrated: LeechFilters = {
        status:    parsed.status    === 'resolved' || parsed.status === 'unresolved'
          ? parsed.status
          : initial.status,
        deckId:    typeof parsed.deckId    === 'string' ? parsed.deckId    : initial.deckId,
        jlptLevel: typeof parsed.jlptLevel === 'string' ? parsed.jlptLevel : initial.jlptLevel,
        cardType:  typeof parsed.cardType  === 'string' ? parsed.cardType  : initial.cardType,
        diagnosis: parsed.diagnosis === 'all' || parsed.diagnosis === 'available' || parsed.diagnosis === 'missing'
          ? parsed.diagnosis
          : initial.diagnosis,
        sort:      SORT_OPTIONS.some((o) => o.key === parsed.sort)
          ? (parsed.sort as LeechSortOrder)
          : initial.sort,
      }
      setFilters(hydrated)
    } catch {
      // Ignore — fallback to the initial value.
    }
    // `initial` is captured at first render — we don't want hydration to
    // fight a changing initial value, so this effect intentionally runs
    // once and never reads `initial` again.
  }, [])

  const update = (next: LeechFilters): void => {
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
 * Filter row for the leeches page. Six dimensions arranged as a horizontal
 * cluster that wraps below sm; the Status pills sit on the left and act as
 * the primary signal (most users only ever care about unresolved), the
 * column-style selects (Deck, JLPT, Card type, Diagnosis) live in the
 * middle, and the Sort select is pushed to the trailing edge so it reads
 * as the "how to order this" affordance rather than a filter.
 *
 * All dropdowns share the same chrome as the Mistakes filter row so the
 * two insights surfaces feel like the same family.
 */
export function LeechesFilterRow({
  value,
  onChange,
}: LeechesFilterRowProps): React.JSX.Element {
  const decksQuery = useDecks(50)
  const decks      = decksQuery.data?.items ?? []
  const deckId     = useId()
  const jlptId     = useId()
  const cardTypeId = useId()
  const diagnosisId = useId()
  const sortId     = useId()

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-soft-hairline pb-5">
      {/* Status pills */}
      <div
        role="tablist"
        aria-label="Leech status"
        className="flex items-center gap-0.5 rounded-[2px] border border-soft-hairline bg-cream-inset/40 p-0.5"
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = opt.key === value.status
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ ...value, status: opt.key })}
              className={[
                'rounded-[2px] px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                active
                  ? 'bg-sumi-ink text-warm-paper-base'
                  : 'text-faded-sumi hover:text-sumi-ink',
              ].join(' ')}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Deck dropdown */}
      <FilterSelect
        id={deckId}
        label="Deck"
        value={value.deckId}
        onChange={(v) => onChange({ ...value, deckId: v })}
        options={[
          { value: 'all', label: 'All decks' },
          ...decks.map((d) => ({ value: d.id, label: d.name })),
        ]}
      />

      {/* JLPT dropdown */}
      <FilterSelect
        id={jlptId}
        label="JLPT"
        value={value.jlptLevel}
        onChange={(v) => onChange({ ...value, jlptLevel: v })}
        options={[
          { value: 'all', label: 'Any level' },
          ...JLPT_OPTIONS.map((lvl) => ({ value: lvl, label: JLPT_LABEL[lvl] ?? lvl })),
        ]}
      />

      {/* Card type dropdown */}
      <FilterSelect
        id={cardTypeId}
        label="Modality"
        value={value.cardType}
        onChange={(v) => onChange({ ...value, cardType: v })}
        options={[
          { value: 'all', label: 'Any type' },
          ...CARD_TYPE_OPTIONS.map((opt) => ({ value: opt.key, label: opt.label })),
        ]}
      />

      {/* Diagnosis dropdown */}
      <FilterSelect
        id={diagnosisId}
        label="Diagnosis"
        value={value.diagnosis}
        onChange={(v) =>
          onChange({
            ...value,
            diagnosis: v === 'available' || v === 'missing' ? v : 'all',
          })
        }
        options={DIAGNOSIS_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
      />

      {/* Sort — trailing edge */}
      <div className="ml-auto">
        <FilterSelect
          id={sortId}
          label="Sort"
          value={value.sort}
          onChange={(v) => {
            const next = SORT_OPTIONS.find((o) => o.key === v)?.key ?? 'mostRecent'
            onChange({ ...value, sort: next })
          }}
          options={SORT_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
        />
      </div>
    </div>
  )
}

// ─── FilterSelect ────────────────────────────────────────────────────────────

interface FilterSelectProps {
  id:       string
  label:    string
  value:    string
  onChange: (next: string) => void
  options:  ReadonlyArray<{ value: string; label: string }>
}

/**
 * Editorial dropdown chrome shared with the Mistakes filter row. Uses a
 * native `<select>` for accessibility (keyboard support, screen-reader
 * label association via the leading `<label>`).
 */
function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: FilterSelectProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-x-2">
      <label
        htmlFor={id}
        className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
