'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { DeckRow } from '@/lib/actions/decks.actions'
import { getDeckStatsAction } from '@/lib/actions/decks.actions'

const BADGE: Record<DeckRow['deckType'], string> = {
  vocabulary: 'bg-primary-100 text-primary-700',
  grammar:    'bg-success-100 text-success-700',
  kanji:      'bg-warning-100 text-warning-700',
  mixed:      'bg-neutral-100 text-neutral-600',
}

interface Props {
  deck:  DeckRow
  index: number
}

export function DeckCard({ deck, index }: Props) {
  const { data: stats } = useQuery({
    queryKey: ['deck-stats', deck.id],
    queryFn:  () => getDeckStatsAction(deck.id),
  })

  const cardCount = stats?.cardCount ?? deck.cardCount
  const dueCount  = stats?.dueCount  ?? 0
  const newCount  = stats?.newCount  ?? deck.cardCount
  const progress  = cardCount > 0 ? Math.round(((cardCount - newCount) / cardCount) * 100) : 0

  return (
    <div
      className="animate-page-enter"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Link
        href={`/decks/${deck.id}`}
        className="block bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3 hover:shadow-md transition-shadow"
      >
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-semibold text-neutral-900 mr-auto">{deck.name}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE[deck.deckType]}`}>
            {deck.deckType}
          </span>
          {deck.isPremadeFork && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
              premade
            </span>
          )}
          {/* Options button — stops link propagation */}
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="text-neutral-400 hover:text-neutral-600 px-1 transition-colors"
            aria-label="Deck options"
          >
            ···
          </button>
        </div>

        {/* Description */}
        {deck.description !== null && (
          <p className="text-sm text-neutral-500 truncate">{deck.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>{cardCount} cards</span>
          {stats !== undefined && stats !== null ? (
            <>
              <span>·</span>
              <span className={dueCount > 0 ? 'text-danger-600 font-medium' : ''}>{dueCount} due</span>
              <span>·</span>
              <span>{newCount} new</span>
            </>
          ) : (
            <>
              <span>·</span>
              <span className="w-10 h-3 bg-neutral-100 rounded animate-pulse inline-block align-middle" />
              <span>·</span>
              <span className="w-8 h-3 bg-neutral-100 rounded animate-pulse inline-block align-middle" />
            </>
          )}
          <span className="ml-auto" />
          {/* Add card button — stops link propagation */}
          <Link
            href={`/decks/${deck.id}/add-card`}
            onClick={(e) => e.stopPropagation()}
            className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            + Add Card
          </Link>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-[width] duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {stats !== undefined && stats !== null && (
          <p className="text-xs text-neutral-400">{progress}% learned</p>
        )}
      </Link>
    </div>
  )
}
