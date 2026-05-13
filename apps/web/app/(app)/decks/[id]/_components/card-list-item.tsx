import Link from 'next/link';

import { JlptPill, PillGroup, StatusPill, type StatusTone } from '@/components/ui/Pill';
import { getWordFields, getSentenceFrontBack, State, type ApiCardListItem } from '@fsrs-japanese/shared-types';

// ─── State pill ───────────────────────────────────────────────────────────────

function statusForState(state: State, isSuspended: boolean): { status: StatusTone; label: string } {
  if (isSuspended) return { status: 'suspended', label: 'Suspended' }
  switch (state) {
    case State.New:        return { status: 'new', label: 'New' }
    case State.Learning:
    case State.Relearning: return { status: 'learning', label: 'Learning' }
    case State.Review:     return { status: 'review', label: 'Review' }
    default: {
      const _exhaustiveCheck: never = state
      return _exhaustiveCheck
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  card:   ApiCardListItem
  deckId: string
}

export function CardListItem({ card, deckId }: Props): React.JSX.Element {
  const wordFields = getWordFields(card)
  const sentence   = getSentenceFrontBack(card)
  const word    = wordFields?.word    ?? sentence?.front ?? '—'
  const reading = wordFields?.reading ?? ''
  const meaning = wordFields?.meaning ?? sentence?.back  ?? ''

  const cardStatus = statusForState(card.state, card.isSuspended)

  return (
    <li>
      <Link
        href={`/decks/${deckId}/cards/${card.id}`}
        className="flex flex-col gap-1.5 bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] border border-soft-hairline px-5 py-4 hover:shadow-[var(--shadow-card)] transition-shadow"
      >
        {/* Row 1: word, reading, status */}
        <div className="flex items-baseline gap-3">
          <span lang="ja" className="text-2xl font-bold text-sumi-ink leading-tight">
            {word}
          </span>
          {reading.length > 0 && (
            <span lang="ja" className="text-sm text-faded-sumi">
              {reading}
            </span>
          )}
          <div className="ml-auto shrink-0">
            <StatusPill status={cardStatus.status} label={cardStatus.label} size="sm" />
          </div>
        </div>

        {/* Row 2: meaning, metadata, options */}
        <div className="flex items-center gap-2">
          <span className="text-base text-sumi-ink truncate">{meaning}</span>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <PillGroup compact maxVisible={1}>
              {card.jlptLevel !== null && <JlptPill level={card.jlptLevel} size="sm" />}
            </PillGroup>
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="text-faded-sumi hover:text-faded-sumi transition-colors px-1 text-sm leading-none"
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
