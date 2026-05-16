'use client'

import type { JlptPillLevel } from '@/components/ui/Pill'
import { JlptPill } from '@/components/ui/Pill'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/utils'

export interface DeckRow {
  id:       string
  name:     string
  level:    JlptPillLevel | null
  dueCount: number
}

interface SetupDeckListProps {
  decks:           ReadonlyArray<DeckRow>
  includedDeckIds: ReadonlyArray<string> | null  // null = all
  onToggle:        (deckId: string, next: boolean) => void
}

function isIncluded(
  deckId:          string,
  includedDeckIds: ReadonlyArray<string> | null,
): boolean {
  if (includedDeckIds === null) return true
  return includedDeckIds.includes(deckId)
}

export function SetupDeckList({
  decks,
  includedDeckIds,
  onToggle,
}: SetupDeckListProps): React.JSX.Element {
  if (decks.length === 0) {
    return <p className="text-sm text-faded-sumi">No decks yet.</p>
  }

  return (
    <ul className="divide-y divide-soft-hairline/70 border-y border-soft-hairline/70">
      {decks.map((deck) => {
        const empty    = deck.dueCount === 0
        const included = isIncluded(deck.id, includedDeckIds) && !empty
        const stateLabel = empty
          ? 'no cards due'
          : included
            ? 'Studying'
            : 'Skip'
        return (
          <li key={deck.id}>
            <button
              type="button"
              onClick={() => { if (!empty) onToggle(deck.id, !included) }}
              disabled={empty}
              aria-pressed={included}
              className={cn(
                'flex w-full items-center gap-4 px-1 py-3.5 text-left',
                'rounded-[2px] transition-colors duration-150 ease-out',
                'hover:bg-cream-inset/50',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                empty && 'cursor-not-allowed hover:bg-transparent',
              )}
            >
              <Checkbox
                checked={included}
                onChange={(next) => onToggle(deck.id, next)}
                ariaLabel={`Include ${deck.name}`}
                disabled={empty}
              />

              <div className="flex min-w-0 flex-1 items-center gap-3">
                <p
                  className={cn(
                    'min-w-0 truncate text-[0.9375rem]',
                    empty ? 'text-faded-sumi' : 'text-sumi-ink',
                  )}
                >
                  {deck.name}
                </p>
                {deck.level !== null && (
                  <JlptPill level={deck.level} size="sm" />
                )}
              </div>

              <p className="shrink-0 font-mono tabular-nums text-sm text-faded-sumi">
                {empty ? '0 due' : `${deck.dueCount} due`}
              </p>

              <p
                className={cn(
                  'shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] tabular-nums',
                  'min-w-[5.5rem] text-right',
                  empty
                    ? 'text-faded-sumi/70'
                    : included
                      ? 'text-inari-vermillion-deep'
                      : 'text-faded-sumi',
                )}
              >
                {stateLabel}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
