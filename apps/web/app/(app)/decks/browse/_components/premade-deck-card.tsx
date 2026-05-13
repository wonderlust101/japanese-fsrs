'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { JlptPill, Pill, PillGroup, StatusPill } from '@/components/ui/Pill'
import type { ApiPremadeDeck } from '@fsrs-japanese/shared-types'

interface Props {
  deck:           ApiPremadeDeck
  forkedDeckId:   string | null
  onSubscribe:    () => void
  isSubscribing:  boolean
}

export function PremadeDeckCard({ deck, forkedDeckId, onSubscribe, isSubscribing }: Props): React.JSX.Element {
  const subscribed = forkedDeckId !== null

  return (
    <article className="flex flex-col p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] border border-soft-hairline shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2">
        <PillGroup compact maxVisible={2}>
          {deck.jlptLevel !== null && <JlptPill level={deck.jlptLevel} size="sm" />}
          {deck.domain !== null && <Pill variant="tag" size="sm">{deck.domain}</Pill>}
        </PillGroup>
        <span className="ml-auto text-xs text-faded-sumi tabular-nums">
          {deck.cardCount} cards
        </span>
      </header>

      <h3 className="mt-2 text-base font-semibold text-sumi-ink leading-snug">{deck.name}</h3>

      {deck.description !== null && (
        <p className="mt-1 text-sm text-faded-sumi line-clamp-2">{deck.description}</p>
      )}

      <footer className="mt-4 flex items-center gap-2">
        {subscribed ? (
          <>
            <StatusPill status="subscribed" label="Subscribed" />
            <Link
              href={`/decks/${forkedDeckId}`}
              className="ml-auto text-sm font-medium text-inari-vermillion hover:text-inari-vermillion"
            >
              Open →
            </Link>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onSubscribe}
            loading={isSubscribing}
            className="ml-auto"
          >
            Subscribe
          </Button>
        )}
      </footer>
    </article>
  )
}
