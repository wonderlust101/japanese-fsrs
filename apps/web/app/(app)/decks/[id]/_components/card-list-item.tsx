import Link from 'next/link';

import { cn } from '@/lib/utils';
import { getWordFields, State } from '@fsrs-japanese/shared-types';
import type { CardItem } from '@/lib/actions/cards.actions';

// ─── JLPT badge ───────────────────────────────────────────────────────────────

const JLPT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  N5:          { bg: 'var(--color-jlpt-n5-bg)',     text: 'var(--color-jlpt-n5-text)',     label: 'N5' },
  N4:          { bg: 'var(--color-jlpt-n4-bg)',     text: 'var(--color-jlpt-n4-text)',     label: 'N4' },
  N3:          { bg: 'var(--color-jlpt-n3-bg)',     text: 'var(--color-jlpt-n3-text)',     label: 'N3' },
  N2:          { bg: 'var(--color-jlpt-n2-bg)',     text: 'var(--color-jlpt-n2-text)',     label: 'N2' },
  N1:          { bg: 'var(--color-jlpt-n1-bg)',     text: 'var(--color-jlpt-n1-text)',     label: 'N1' },
  beyond_jlpt: { bg: 'var(--color-jlpt-beyond-bg)', text: 'var(--color-jlpt-beyond-text)', label: '∞' },
}

// ─── State dot ────────────────────────────────────────────────────────────────

function dotClass(state: State, isSuspended: boolean): string {
  if (isSuspended) return 'bg-neutral-300'
  switch (state) {
    case State.New:        return 'bg-neutral-400'
    case State.Learning:
    case State.Relearning: return 'bg-warning-500'
    case State.Review:     return 'bg-success-500'
    default: {
      const _exhaustiveCheck: never = state
      return _exhaustiveCheck
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  card:   CardItem
  deckId: string
}

export function CardListItem({ card, deckId }: Props): React.JSX.Element {
  const wordFields = getWordFields(card)
  const sentenceFd = wordFields === null
    ? card.fieldsData as Record<string, unknown>
    : null
  const word    = wordFields?.word    ?? (typeof sentenceFd?.['front'] === 'string' ? sentenceFd['front'] : '—')
  const reading = wordFields?.reading ?? ''
  const meaning = wordFields?.meaning ?? (typeof sentenceFd?.['back']  === 'string' ? sentenceFd['back']  : '')

  const jlpt    = card.jlptLevel !== null ? JLPT_STYLE[card.jlptLevel] : undefined

  return (
    <li>
      <Link
        href={`/decks/${deckId}/cards/${card.id}`}
        className="flex flex-col gap-1.5 bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] border border-neutral-200 px-5 py-4 hover:shadow-[var(--shadow-card)] transition-shadow"
      >
        {/* Row 1: word · reading · status dot */}
        <div className="flex items-baseline gap-3">
          <span lang="ja" className="text-2xl font-bold text-neutral-900 leading-tight">
            {word}
          </span>
          {reading.length > 0 && (
            <span lang="ja" className="text-sm text-neutral-500">
              {reading}
            </span>
          )}
          <span
            className={cn('ml-auto shrink-0 h-2.5 w-2.5 rounded-full', dotClass(card.state, card.isSuspended))}
            aria-label={card.isSuspended ? 'suspended' : State[card.state].toLowerCase()}
          />
        </div>

        {/* Row 2: meaning · JLPT badge · ··· */}
        <div className="flex items-center gap-2">
          <span className="text-base text-neutral-700 truncate">{meaning}</span>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {jlpt !== undefined && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: jlpt.bg, color: jlpt.text }}
              >
                {jlpt.label}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="text-neutral-400 hover:text-neutral-600 transition-colors px-1 text-sm leading-none"
              aria-label="Card options"
            >
              ···
            </button>
          </div>
        </div>
      </Link>
    </li>
  )
}
