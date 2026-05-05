'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import type { ApiPremadeDeck } from '@fsrs-japanese/shared-types'

const JLPT_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  N5:          { bg: 'var(--color-jlpt-n5-bg)',     text: 'var(--color-jlpt-n5-text)',     label: 'N5' },
  N4:          { bg: 'var(--color-jlpt-n4-bg)',     text: 'var(--color-jlpt-n4-text)',     label: 'N4' },
  N3:          { bg: 'var(--color-jlpt-n3-bg)',     text: 'var(--color-jlpt-n3-text)',     label: 'N3' },
  N2:          { bg: 'var(--color-jlpt-n2-bg)',     text: 'var(--color-jlpt-n2-text)',     label: 'N2' },
  N1:          { bg: 'var(--color-jlpt-n1-bg)',     text: 'var(--color-jlpt-n1-text)',     label: 'N1' },
  beyond_jlpt: { bg: 'var(--color-jlpt-beyond-bg)', text: 'var(--color-jlpt-beyond-text)', label: '∞'  },
}

interface Props {
  deck:           ApiPremadeDeck
  forkedDeckId:   string | null
  onSubscribe:    () => void
  isSubscribing:  boolean
}

export function PremadeDeckCard({ deck, forkedDeckId, onSubscribe, isSubscribing }: Props): React.JSX.Element {
  const subscribed = forkedDeckId !== null
  const jlpt = deck.jlptLevel !== null ? JLPT_BADGE[deck.jlptLevel] : undefined

  return (
    <article className="flex flex-col p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] border border-neutral-200 shadow-[var(--shadow-card)]">
      <header className="flex items-center gap-2">
        {jlpt !== undefined && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: jlpt.bg, color: jlpt.text }}
          >
            {jlpt.label}
          </span>
        )}
        {deck.domain !== null && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
            {deck.domain}
          </span>
        )}
        <span className="ml-auto text-xs text-neutral-400 tabular-nums">
          {deck.cardCount} cards
        </span>
      </header>

      <h3 className="mt-2 text-base font-semibold text-neutral-900 leading-snug">{deck.name}</h3>

      {deck.description !== null && (
        <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{deck.description}</p>
      )}

      <footer className="mt-4 flex items-center gap-2">
        {subscribed ? (
          <>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-success-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Subscribed
            </span>
            <Link
              href={`/decks/${forkedDeckId}`}
              className="ml-auto text-sm font-medium text-primary-600 hover:text-primary-700"
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
