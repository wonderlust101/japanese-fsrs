'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWordFields, getSentenceFrontBack, type ApiCardListItem, type ApiDeck } from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { queryKeys } from '@/lib/api/queryKeys'
import { listDecksAction } from '@/lib/actions/decks.actions'

export type CardDeckPickerVariant = 'move' | 'add'

interface Props {
  /** The card being moved or copied. Dialog stays closed when null. */
  card:           ApiCardListItem | null
  /** ID of the deck the card currently belongs to. Excluded from picker. */
  currentDeckId:  string
  /** Move = relocate; Add = duplicate (card stays here too). Drives copy. */
  variant:        CardDeckPickerVariant
  /** Whether the submit mutation is in-flight. */
  isSubmitting:   boolean
  /** Error message from the last attempted submit, if any. */
  errorMessage:   string | null
  onCancel:       () => void
  onConfirm:      (card: ApiCardListItem, targetDeckId: string) => void
}

const VARIANT_COPY: Record<CardDeckPickerVariant, {
  eyebrow:     { kanji: string; label: string }
  title:       string
  description: (word: string) => React.ReactNode
  submit:      string
}> = {
  move: {
    eyebrow: { kanji: '移', label: 'Move card' },
    title:   'Move card to another deck',
    description: (word) => (
      <>
        Move{' '}
        <span lang="ja" className="font-semibold text-sumi-ink">{word}</span>{' '}
        to a different deck. Its review history and FSRS state stay with the card.
      </>
    ),
    submit: 'Move card',
  },
  add: {
    eyebrow: { kanji: '加', label: 'Add a copy' },
    title:   'Add a copy to another deck',
    description: (word) => (
      <>
        Add a fresh copy of{' '}
        <span lang="ja" className="font-semibold text-sumi-ink">{word}</span>{' '}
        to another deck. The original card stays here; the copy starts as new in the target deck.
      </>
    ),
    submit: 'Add copy',
  },
}

/**
 * Modal that lets the learner relocate a card to another deck. Lists the
 * user's own decks (excluding the current deck and any premade source decks)
 * as a radio group; on confirm, fires the parent's move handler with the
 * selected deck id.
 *
 * The list view uses the existing decks list query (cached, fast) so opening
 * the dialog is instant on a warm cache.
 */
export function MoveCardDialog({
  card,
  currentDeckId,
  variant,
  isSubmitting,
  errorMessage,
  onCancel,
  onConfirm,
}: Props): React.JSX.Element {
  const open = card !== null
  const copy = VARIANT_COPY[variant]

  const { data: decksList, isLoading } = useQuery({
    queryKey: queryKeys.decks.list(),
    queryFn:  () => listDecksAction(),
    enabled:  open,
  })

  const targetDecks: ApiDeck[] = useMemo(() => {
    const all = decksList?.items ?? []
    return all.filter((d) => d.id !== currentDeckId)
  }, [decksList, currentDeckId])

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)

  // Reset the selection whenever the dialog is reopened on a different card,
  // or when the target deck list changes underneath us.
  useEffect(() => {
    if (!open) setSelectedDeckId(null)
  }, [open, card?.id])

  const word = useMemo(() => {
    if (card === null) return ''
    const wordFields = getWordFields(card)
    const sentence   = getSentenceFrontBack(card)
    return wordFields?.word ?? sentence?.front ?? 'this card'
  }, [card])

  const noOtherDecks = !isLoading && targetDecks.length === 0
  const canSubmit    = card !== null && selectedDeckId !== null && !isSubmitting

  const visibleDeckCount = targetDecks.length

  return (
    <Dialog open={open} onClose={onCancel} title={copy.title} eyebrow={copy.eyebrow} size="xl">
      <p className="mb-5 text-sm text-faded-sumi">
        {copy.description(word)}
      </p>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className="dashboard-skeleton block h-12 w-full rounded-[2px]"
            />
          ))}
        </div>
      )}

      {!isLoading && noOtherDecks && (
        <div className="rounded-[2px] border border-soft-hairline bg-cream-inset/45 p-4 text-center text-sm text-faded-sumi">
          You don't have any other decks to move this card to. Create another deck first.
        </div>
      )}

      {!isLoading && !noOtherDecks && (
        <>
          {visibleDeckCount > 0 && (
            <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
              {visibleDeckCount} {visibleDeckCount === 1 ? 'deck' : 'decks'} available
            </p>
          )}
          {/* role="radiogroup" instead of <fieldset> to sidestep the
              browser's fieldset default `min-inline-size: min-content`,
              which can collapse the element in flex contexts. Background
              is `cream-inset/40` (a step inset from the dialog's warm
              paper) so the list reads as a distinct surface. */}
          <div
            role="radiogroup"
            aria-label="Target decks"
            className="max-h-96 overflow-y-auto rounded-[2px] border border-soft-hairline bg-cream-inset/40"
          >
            {targetDecks.map((deck, i) => {
              const checked = deck.id === selectedDeckId
              const updated = formatRelativeUpdate(deck.updatedAt)
              return (
                <label
                  key={deck.id}
                  className={[
                    'ui-motion-colors group/option flex cursor-pointer items-start gap-3 px-4 py-3 text-sm',
                    i > 0 ? 'border-t border-soft-hairline' : '',
                    checked
                      ? 'bg-vermillion-wash text-sumi-ink'
                      : 'bg-warm-paper-raised text-sumi-ink hover:bg-cream-inset',
                  ].join(' ')}
                >
                  <span className="mt-1 shrink-0">
                    <RadioMark checked={checked} />
                  </span>
                  <input
                    type="radio"
                    name="target-deck"
                    value={deck.id}
                    checked={checked}
                    onChange={() => setSelectedDeckId(deck.id)}
                    disabled={isSubmitting}
                    className="sr-only"
                  />

                  {/* Identity column: deck name + quiet 'last updated'
                      metadata line. */}
                  <div className="min-w-0 flex-1">
                    <span
                      className={[
                        'block min-w-0 truncate text-base leading-snug',
                        checked ? 'font-semibold' : 'font-medium',
                      ].join(' ')}
                    >
                      {deck.name}
                    </span>
                    <p className="mt-0.5 truncate font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-faded-sumi">
                      Updated <span className="text-sumi-ink/70">{updated}</span>
                    </p>
                  </div>

                  {/* Right column: prominent card count. */}
                  <div className="flex shrink-0 flex-col items-end leading-none">
                    <span className="font-mono text-xl font-semibold tabular-nums text-sumi-ink">
                      {deck.cardCount}
                    </span>
                    <span className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
                      {deck.cardCount === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                </label>
              )
            })}
          </div>
        </>
      )}

      {errorMessage !== null && (
        <p role="alert" className="mt-3 text-sm text-inari-vermillion-deep">
          {errorMessage}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={isSubmitting}
          disabled={!canSubmit}
          onClick={() => {
            if (card !== null && selectedDeckId !== null) onConfirm(card, selectedDeckId)
          }}
        >
          {copy.submit}
        </Button>
      </div>
    </Dialog>
  )
}

/**
 * Custom radio glyph matching the brand: a 14px square with a 2px
 * inner vermillion fill when selected. Drawn entirely with Tailwind so
 * the dot inherits brand tones instead of the browser's default accent.
 * The actual <input type="radio"> is sr-only — accessibility comes from
 * the wrapping <label> + keyboard radio-group semantics.
 */
/**
 * Compact "x ago" formatter for the row's metadata line. Falls back to a
 * short month/day when the difference exceeds about a month.
 */
function formatRelativeUpdate(iso: string): string {
  const then  = new Date(iso).getTime()
  const now   = Date.now()
  const diffMs = now - then
  if (Number.isNaN(diffMs) || diffMs < 0) return 'just now'

  const minute = 60 * 1000
  const hour   = 60 * minute
  const day    = 24 * hour
  const week   = 7  * day

  if (diffMs < minute)     return 'just now'
  if (diffMs < hour)       return `${Math.floor(diffMs / minute)}m ago`
  if (diffMs < day)        return `${Math.floor(diffMs / hour)}h ago`
  if (diffMs < day * 30)   return `${Math.floor(diffMs / day)}d ago`
  if (diffMs < day * 365)  return `${Math.floor(diffMs / week / 4)}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RadioMark({ checked }: { checked: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={[
        'ui-motion-colors flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border',
        checked
          ? 'border-inari-vermillion bg-warm-paper-raised'
          : 'border-soft-hairline bg-warm-paper-raised group-hover/option:border-faded-sumi',
      ].join(' ')}
    >
      {checked && (
        <span className="block h-1.5 w-1.5 bg-inari-vermillion" />
      )}
    </span>
  )
}
