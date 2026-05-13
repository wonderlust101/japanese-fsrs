'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { ApiDeck } from '@fsrs-japanese/shared-types'
import { JlptPill, PillGroup, StatusPill } from '@/components/ui/Pill'
import { getDeckAction } from '@/lib/actions/decks.actions'
import { queryKeys } from '@/lib/api/queryKeys'
import { inferDeckLevel } from '@/lib/deck-level'

interface Props {
  deck:  ApiDeck
  index: number
}

export function DeckCard({ deck, index }: Props): React.JSX.Element {
  const { data: stats } = useQuery({
    queryKey: queryKeys.decks.detail(deck.id),
    queryFn:  () => getDeckAction(deck.id),
  })

  const cardCount = stats?.cardCount ?? deck.cardCount
  const dueCount  = stats?.dueCount  ?? 0
  const newCount  = stats?.newCount  ?? deck.cardCount
  const progress  = cardCount > 0 ? Math.round(((cardCount - newCount) / cardCount) * 100) : 0
  const level     = inferDeckLevel(deck)

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
          <span className="text-base font-semibold text-sumi-ink mr-auto">{deck.name}</span>
          <PillGroup compact>
            {level !== null && <JlptPill level={level} size="sm" />}
            {deck.isPremadeFork && (
              <StatusPill status="premade" label="Premade" size="sm" />
            )}
          </PillGroup>
          {/* Options button — stops link propagation */}
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="text-faded-sumi hover:text-faded-sumi px-1 transition-colors"
            aria-label="Deck options"
          >
            ···
          </button>
        </div>

        {/* Description */}
        {deck.description !== null && (
          <p className="text-sm text-faded-sumi truncate">{deck.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-faded-sumi">
          <span>{cardCount} cards</span>
          {stats !== undefined && stats !== null ? (
            <>
              <span>·</span>
              <span className={dueCount > 0 ? 'text-error font-medium' : ''}>{dueCount} due</span>
              <span>·</span>
              <span>{newCount} new</span>
            </>
          ) : (
            <>
              <span>·</span>
              <span className="w-10 h-3 bg-cream-inset rounded animate-pulse inline-block align-middle" />
              <span>·</span>
              <span className="w-8 h-3 bg-cream-inset rounded animate-pulse inline-block align-middle" />
            </>
          )}
          <span className="ml-auto" />
          {/* Add card button — stops link propagation */}
          <Link
            href={`/decks/${deck.id}/add-card`}
            onClick={(e) => e.stopPropagation()}
            className="text-inari-vermillion hover:text-inari-vermillion font-medium transition-colors"
          >
            + Add Card
          </Link>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-cream-inset rounded-full overflow-hidden">
          <div
            className="h-full bg-inari-vermillion rounded-full transition-[width] duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {stats !== undefined && stats !== null && (
          <p className="text-xs text-faded-sumi">{progress}% learned</p>
        )}
      </Link>
    </div>
  )
}
