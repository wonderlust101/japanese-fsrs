import Link from 'next/link'

import { JlptPill, PillGroup } from '@/components/ui/Pill'
import { IconMore, IconDelete, IconEdit, IconCopy, IconPlus } from '@/components/icons/chrome-marks'
import {
  DecksMenu,
  MenuItem,
  MenuSeparator,
} from '@/app/(app)/decks/_components/decks-menu'
import { getWordFields, getSentenceFrontBack, State, type ApiCardListItem } from '@fsrs-japanese/shared-types'

// ─── State mapping ────────────────────────────────────────────────────────────

interface StateChip {
  glyph: string
  label: string
}

function chipForState(state: State, isSuspended: boolean): StateChip {
  if (isSuspended) return { glyph: '×', label: 'Sus' }
  switch (state) {
    case State.New:        return { glyph: '+', label: 'New' }
    case State.Learning:
    case State.Relearning: return { glyph: '◐', label: 'Lrn' }
    case State.Review:     return { glyph: '↻', label: 'Rev' }
    default: {
      const _exhaustiveCheck: never = state
      return _exhaustiveCheck
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  card:     ApiCardListItem
  onAdd:    (card: ApiCardListItem) => void
  onMove:   (card: ApiCardListItem) => void
  onDelete: (card: ApiCardListItem) => void
}

/**
 * Card row that shares the chrome vocabulary of the redesigned deck rows:
 *   - 2px vermillion top stripe
 *   - Side hairlines (l/r/b)
 *   - Leading column with cream-inset tint carrying the card's state
 *   - Two-line content area
 *
 * The leading column is the per-row analogue of the deck row's slot index:
 * one glanceable identity marker on the left so a list of rows reads as a
 * sequence of cataloged entries, not anonymous bordered boxes.
 */
export function CardListItem({ card, onAdd, onMove, onDelete }: Props): React.JSX.Element {
  const wordFields = getWordFields(card)
  const sentence   = getSentenceFrontBack(card)
  const word    = wordFields?.word    ?? sentence?.front ?? '—'
  const reading = wordFields?.reading ?? ''
  const meaning = wordFields?.meaning ?? sentence?.back  ?? ''

  const chip       = chipForState(card.state, card.isSuspended)
  const isSuspended = card.isSuspended

  // Suspended cards are visually quieted: the brand stripe goes transparent
  // and the surface drops to a muted variant. Matches how archived decks are
  // rendered on the Decks list page.
  const stripeColor = isSuspended ? 'transparent' : 'var(--color-inari-vermillion)'
  const surfaceTone = isSuspended ? 'bg-warm-paper-raised/60' : 'bg-warm-paper-raised'

  return (
    <li className="group/card relative">
      <Link
        href={`/cards/${card.id}`}
        className="ui-motion-colors block focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <div
          className={[
            'relative overflow-hidden rounded-[2px] border-l border-r border-b border-soft-hairline',
            surfaceTone,
            'group-hover/card:bg-cream-inset/40',
            'ui-motion-colors',
          ].join(' ')}
        >
          {/* Brand identity stripe. */}
          <span
            aria-hidden="true"
            className="absolute top-0 -left-px -right-px h-[2px]"
            style={{ backgroundColor: stripeColor }}
          />

          <div className="flex">
            {/* Leading state column — the per-card analogue of the deck row's
                slot index. Glyph above a small-caps mono label. */}
            <div className="flex w-[2.75rem] shrink-0 flex-col items-center justify-center gap-1 border-r border-soft-hairline bg-cream-inset/40 px-1 py-3.5 sm:w-14 sm:py-4">
              <span
                aria-hidden="true"
                className={[
                  'text-base leading-none',
                  isSuspended ? 'text-faded-sumi/70' : 'text-inari-vermillion',
                ].join(' ')}
              >
                {chip.glyph}
              </span>
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-faded-sumi">
                {chip.label}
              </span>
            </div>

            {/* Content surface */}
            <div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5 sm:py-4">
              {/* Row 1 — Japanese word + inline reading; kebab reserves space
                  on the right so the word/reading don't sit under it. */}
              <div className="flex min-w-0 items-baseline gap-3 pr-8">
                <span
                  lang="ja"
                  className={[
                    'min-w-0 truncate text-lg font-semibold leading-tight',
                    isSuspended ? 'text-faded-sumi' : 'text-sumi-ink',
                  ].join(' ')}
                >
                  {word}
                </span>
                {reading.length > 0 && (
                  <span lang="ja" className="shrink-0 truncate text-sm leading-tight text-faded-sumi">
                    {reading}
                  </span>
                )}
              </div>

              {/* Row 2 — English meaning + JLPT pill */}
              <div className="mt-1.5 flex items-center gap-2 pr-8">
                <span
                  className={[
                    'min-w-0 truncate text-sm leading-snug',
                    isSuspended ? 'text-faded-sumi' : 'text-sumi-ink/80',
                  ].join(' ')}
                >
                  {meaning}
                </span>
                <div className="ml-auto shrink-0">
                  <PillGroup compact maxVisible={1}>
                    {card.jlptLevel !== null && <JlptPill level={card.jlptLevel} size="sm" />}
                  </PillGroup>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Kebab — floats over the row's top-right corner so clicking it
          doesn't trigger the row's Link. The menu items use their own
          handlers; nothing here delegates to the row navigation. */}
      <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
        <DecksMenu
          align="end"
          menuClassName="min-w-[11rem]"
          renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
            <button
              ref={triggerRef}
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
              onKeyDown={onKeyDown}
              aria-haspopup="menu"
              aria-expanded={ariaExpanded}
              aria-label="Card actions"
              className="ui-motion-colors flex h-7 w-7 items-center justify-center rounded-[2px] text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              <IconMore className="h-4 w-4" />
            </button>
          )}
          renderItems={({ close }) => (
            <>
              <Link href={`/cards/${card.id}`}>
                <MenuItem
                  leading={<IconEdit className="h-3.5 w-3.5" />}
                  onClick={close}
                >
                  Edit card
                </MenuItem>
              </Link>
              <MenuItem
                leading={<IconPlus className="h-3.5 w-3.5" />}
                onClick={() => { onAdd(card); close() }}
              >
                Add a copy to another deck…
              </MenuItem>
              <MenuItem
                leading={<IconCopy className="h-3.5 w-3.5" />}
                onClick={() => { onMove(card); close() }}
              >
                Move to another deck…
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                leading={<IconDelete className="h-3.5 w-3.5" />}
                onClick={() => { onDelete(card); close() }}
                danger
              >
                Delete card
              </MenuItem>
            </>
          )}
        />
      </div>
    </li>
  )
}
