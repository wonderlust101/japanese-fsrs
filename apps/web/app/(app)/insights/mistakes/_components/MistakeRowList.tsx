'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { FuriganaText } from '@/components/ui/FuriganaText'

import type { LeechRow, MistakeCard } from './mistakesTypes'

interface MistakeRowListProps<Row extends MistakeCard | LeechRow> {
  rows:    ReadonlyArray<Row>
  /** Optional empty-state copy when the list has zero rows. */
  emptyText?: string
  /** Render extra inline content under each row (e.g. leech diagnosis). */
  renderExtra?: (row: Row) => React.ReactNode
}

const RATING_BG: Record<'again' | 'hard' | 'good' | 'easy', string> = {
  again: 'bg-rating-again text-warm-paper-base',
  hard:  'bg-rating-hard  text-warm-paper-base',
  good:  'bg-rating-good  text-warm-paper-base',
  easy:  'bg-rating-easy  text-warm-paper-base',
}

const RATING_LABEL: Record<'again' | 'hard' | 'good' | 'easy', string> = {
  again: 'Again',
  hard:  'Hard',
  good:  'Good',
  easy:  'Easy',
}

/**
 * Shared row + bulk-select primitive for Problem Cards and Leeches.
 *
 * Per the IA brief (Q9=B, Q16=C): clicking the row's content area
 * navigates to `/cards/[id]`; the leading checkbox toggles selection
 * for bulk action. When at least one row is selected, an inline
 * "{N} selected" bar appears under the list with Review / Repair /
 * Suspend buttons. Multi-select is scoped to this list instance — each
 * mounting (Problem Cards vs Leeches) maintains its own selection.
 */
export function MistakeRowList<Row extends MistakeCard | LeechRow>({
  rows,
  emptyText,
  renderExtra,
}: MistakeRowListProps<Row>): React.JSX.Element {
  const router = useRouter()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const clearSelection = (): void => setSelected(new Set())

  if (rows.length === 0) {
    return (
      <p className="rounded-[2px] border border-dashed border-soft-hairline bg-cream-inset/50 px-5 py-6 text-sm italic leading-relaxed text-faded-sumi">
        {emptyText ?? 'Nothing flagged.'}
      </p>
    )
  }

  const selectedCount = selected.size
  const selectedIds = Array.from(selected)

  return (
    <div className="flex flex-col">
      <ul role="list" className="flex flex-col divide-y divide-soft-hairline border-y border-soft-hairline">
        {rows.map((row) => {
          const checked = selected.has(row.id)
          return (
            <li key={row.id} className="flex items-stretch">
              {/* Checkbox column */}
              <label
                className="flex w-10 shrink-0 cursor-pointer items-center justify-center border-r border-soft-hairline bg-warm-paper-raised/40 transition-colors hover:bg-cream-inset/60"
              >
                <span className="sr-only">Select {row.word}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(row.id)}
                  className="h-4 w-4 cursor-pointer accent-inari-vermillion"
                />
              </label>

              {/* Body — clickable area */}
              <button
                type="button"
                onClick={() => router.push(`/cards/${row.id}`)}
                className="group flex flex-1 flex-col gap-y-1.5 px-4 py-3.5 text-left transition-colors hover:bg-cream-inset/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-2px]"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-[1.0625rem] text-sumi-ink">
                    <FuriganaText text={row.word} reading={row.reading} />
                  </span>
                  <span className="text-sm text-faded-sumi">{row.meaning}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
                  <span>
                    <span className="text-sumi-ink/85">{row.lapses}</span>{' '}
                    {row.lapses === 1 ? 'lapse' : 'lapses'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{row.deckName}</span>
                  {row.daysSinceLastReview !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>last reviewed {row.daysSinceLastReview}d ago</span>
                    </>
                  )}
                  {row.lastResult !== null && (
                    <span
                      className={[
                        'rounded-[2px] px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.16em]',
                        RATING_BG[row.lastResult],
                      ].join(' ')}
                    >
                      {RATING_LABEL[row.lastResult]}
                    </span>
                  )}
                </div>
                {renderExtra !== undefined && renderExtra(row)}
              </button>
            </li>
          )
        })}
      </ul>

      {/* Inline bulk-select bar (per-section scope) */}
      {selectedCount > 0 && (
        <div
          role="region"
          aria-label="Bulk selection actions"
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-4 py-3"
        >
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-sumi-ink">
            <span className="tabular-nums">{selectedCount}</span>{' '}
            {selectedCount === 1 ? 'card' : 'cards'} selected
            <button
              type="button"
              onClick={clearSelection}
              className="ml-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              Clear
            </button>
          </p>
          <div className="flex items-center gap-2">
            <BulkActionButton
              tone="primary"
              onClick={() => router.push(`/review/setup?cards=${selectedIds.join(',')}`)}
            >
              Review
            </BulkActionButton>
            <BulkActionButton
              tone="primary"
              onClick={() => router.push(`/review/repair?cards=${selectedIds.join(',')}`)}
            >
              Repair
            </BulkActionButton>
            <BulkActionButton
              tone="quiet"
              onClick={() => {
                /* Suspend wires through cards.actions.suspend; out of scope for this pass. */
                clearSelection()
              }}
            >
              Suspend
            </BulkActionButton>
          </div>
        </div>
      )}
    </div>
  )
}

interface BulkActionButtonProps {
  tone:     'primary' | 'quiet'
  onClick:  () => void
  children: React.ReactNode
}

function BulkActionButton({ tone, onClick, children }: BulkActionButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-[2px] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        tone === 'primary'
          ? 'bg-sumi-ink text-warm-paper-base hover:bg-sumi-ink/85'
          : 'border border-soft-hairline text-faded-sumi hover:border-sumi-ink hover:text-sumi-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
