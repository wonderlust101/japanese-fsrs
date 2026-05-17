'use client'

import { useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { SectionCard } from '@/components/ui/SectionCard'
import { IconEdit, IconDelete, IconReveal, IconHide } from '@/components/icons/chrome-marks'

interface Props {
  deckId:     string
  isArchived: boolean
  onRename:   () => void
  onArchive:  () => void
  onRestore:  () => void
  onDelete:   () => void
}

/**
 * Collapsed-by-default options panel. Expands to a small button column with
 * the actions that already have wired dialogs / handlers in the app.
 *
 * Per-deck scheduling controls (daily new-card limit, FSRS preset, review
 * order) are stubbed as a follow-up — none of those have backend wiring yet.
 */
export function DeckOptionsPanel({
  deckId,
  isArchived,
  onRename,
  onArchive,
  onRestore,
  onDelete,
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <SectionCard
      kanji="設"
      label="Deck options"
      rightContent={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="deck-options-body"
          className="ui-motion-colors inline-flex items-center gap-1 rounded-[2px] px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          <span>{open ? 'Hide' : 'Show'}</span>
          <Chevron open={open} />
        </button>
      }
    >
      <div id="deck-options-body" hidden={!open}>
        <div className="flex flex-col gap-3 pt-2">
          <ActionRow
            label="Rename deck"
            description="Change the display name for this deck."
            action={
              <Button size="sm" variant="secondary" onClick={onRename} leadingIcon={<IconEdit className="h-3.5 w-3.5" />}>
                Rename
              </Button>
            }
          />
          <ActionRow
            label="Open cards in Cards"
            description="Browse this deck's cards in the global Cards browser, with the deck filter applied."
            action={
              <Link href={`/cards?deck=${encodeURIComponent(deckId)}`}>
                <Button size="sm" variant="secondary">Open</Button>
              </Link>
            }
          />
          <ActionRow
            label={isArchived ? 'Restore from archive' : 'Archive deck'}
            description={
              isArchived
                ? 'Bring this deck back into the active study queue.'
                : 'Hide this deck from the active study queue. You can restore it any time.'
            }
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={isArchived ? onRestore : onArchive}
                leadingIcon={
                  isArchived
                    ? <IconReveal className="h-3.5 w-3.5" />
                    : <IconHide className="h-3.5 w-3.5" />
                }
              >
                {isArchived ? 'Restore' : 'Archive'}
              </Button>
            }
          />
          <ActionRow
            label="Delete deck"
            description="Permanently remove this deck and all its cards. This cannot be undone."
            action={
              <Button
                size="sm"
                variant="danger"
                onClick={onDelete}
                leadingIcon={<IconDelete className="h-3.5 w-3.5" />}
              >
                Delete
              </Button>
            }
            danger
          />
          {/* Per-deck scheduling controls (daily new limit, FSRS preset,
              review order) are a follow-up: the API currently has no
              endpoints for them. When those land, plug them in above the
              destructive actions. */}
        </div>
      </div>
    </SectionCard>
  )
}

function ActionRow({
  label,
  description,
  action,
  danger,
}: {
  label:       string
  description: string
  action:      React.ReactNode
  danger?:     boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-start justify-between gap-2 border-t border-soft-hairline pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${danger === true ? 'text-inari-vermillion-deep' : 'text-sumi-ink'}`}>
          {label}
        </p>
        <p className="mt-0.5 text-xs text-faded-sumi">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M2 4l3 3 3-3" />
    </svg>
  )
}
