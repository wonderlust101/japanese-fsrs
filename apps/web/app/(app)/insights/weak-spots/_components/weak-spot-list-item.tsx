'use client'

import { useRouter } from 'next/navigation'

import { FuriganaText } from '@/components/ui/FuriganaText'
import { Pill, type JlptPillLevel } from '@/components/ui/Pill'
import type { ApiWeakSpotListItem } from '@fsrs-japanese/shared-types'

interface WeakSpotListItemProps {
  weakSpot:       ApiWeakSpotListItem
  onOpen:      (weakSpotId: string) => void
  onResolve:   (weakSpotId: string) => void
  onReopen:    (weakSpotId: string) => void
  isMutating:  boolean
}

/**
 * Single weakSpot row. Anatomy ordered top-down:
 *
 *   1. Japanese hero — word with optional furigana, meaning aside.
 *   2. Metadata strip — deck · modality · JLPT pill · lapses · last review.
 *   3. Diagnosis status — small editorial note when present.
 *   4. Row actions — Drill / View / Resolve (or Reopen for resolved rows).
 *
 * Orphan rows (`cardId === null` and word/reading/meaning all null) render a
 * dimmed "card no longer exists" line — the doc explicitly preserves weakSpot
 * history even after card deletion, so the row must not crash on missing
 * fields, but it also must clearly communicate that drilling/resolving in
 * the live way isn't possible. For now those rows only expose the inert
 * "View details" path; Drill and Resolve are hidden.
 *
 * Row container is the clickable element. The action cluster uses
 * `event.stopPropagation()` so clicking Drill/Resolve doesn't also open the
 * detail dialog.
 */
export function WeakSpotListItem({
  weakSpot,
  onOpen,
  onResolve,
  onReopen,
  isMutating,
}: WeakSpotListItemProps): React.JSX.Element {
  const router       = useRouter()
  const isOrphan     = weakSpot.cardId === null
  const lapseCount   = weakSpot.lapses ?? 0
  const lastReviewMs = weakSpot.lastReview === null ? null : Date.parse(weakSpot.lastReview)
  const lastReviewLabel =
    lastReviewMs === null
      ? null
      : formatRelativeDays(Math.round((Date.now() - lastReviewMs) / 86_400_000))
  const detectedMs   = Date.parse(weakSpot.createdAt)
  const detectedLabel = formatRelativeDays(Math.round((Date.now() - detectedMs) / 86_400_000))
  const hasDiagnosis = weakSpot.diagnosis !== null && weakSpot.diagnosis !== ''

  return (
    <li className="group relative flex flex-col gap-y-3 border-b border-soft-hairline px-4 py-4 last:border-b-0 sm:px-5 sm:py-5">
      {/* Hero row — clickable text area opens the detail dialog */}
      <button
        type="button"
        onClick={() => onOpen(weakSpot.id)}
        className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-display text-[1.0625rem] leading-tight text-sumi-ink sm:text-[1.125rem]">
            {weakSpot.word !== null && weakSpot.reading !== null ? (
              <FuriganaText text={weakSpot.word} reading={weakSpot.reading} />
            ) : (
              <span className={isOrphan ? 'italic text-faded-sumi' : ''}>
                {weakSpot.word ?? 'Card no longer exists'}
              </span>
            )}
          </span>
          {weakSpot.meaning !== null && (
            <span className="text-sm text-faded-sumi">{weakSpot.meaning}</span>
          )}
        </div>
      </button>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span>
          <span className="tabular-nums text-sumi-ink/85">{lapseCount}</span>{' '}
          {lapseCount === 1 ? 'lapse' : 'lapses'}
        </span>
        {weakSpot.deckName !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate normal-case tracking-normal">{weakSpot.deckName}</span>
          </>
        )}
        {weakSpot.jlptLevel !== null && (
          <>
            <span aria-hidden="true">·</span>
            <Pill
              variant="level"
              tone={jlptPillTone(weakSpot.jlptLevel)}
              size="sm"
            >
              {weakSpot.jlptLevel === 'beyond_jlpt' ? 'Beyond' : weakSpot.jlptLevel}
            </Pill>
          </>
        )}
        {lastReviewLabel !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span>last reviewed {lastReviewLabel}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>flagged {detectedLabel}</span>
        {weakSpot.resolved && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-aizome-indigo">Resolved</span>
          </>
        )}
      </div>

      {/* Diagnosis status — editorial line */}
      {hasDiagnosis ? (
        <p className="max-w-prose text-[0.8125rem] italic leading-relaxed text-sumi-ink/85">
          {weakSpot.diagnosis}
        </p>
      ) : !isOrphan && !weakSpot.resolved ? (
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi/85">
          Diagnosis · not requested yet
        </p>
      ) : null}

      {/* Action cluster */}
      <div className="flex flex-wrap items-center gap-2">
        {!isOrphan && !weakSpot.resolved && (
          <RowAction
            tone="primary"
            onClick={() => router.push(`/insights/weak-spots/drill/setup?cardId=${weakSpot.cardId}`)}
            ariaLabel={`Drill ${weakSpot.word ?? 'this card'}`}
          >
            Drill
          </RowAction>
        )}
        <RowAction
          tone="quiet"
          onClick={() => onOpen(weakSpot.id)}
          ariaLabel="View details"
        >
          View details
        </RowAction>
        {!isOrphan && !weakSpot.resolved && (
          <RowAction
            tone="quiet"
            onClick={() => onResolve(weakSpot.id)}
            ariaLabel={`Mark ${weakSpot.word ?? 'this card'} resolved`}
            disabled={isMutating}
          >
            Mark resolved
          </RowAction>
        )}
        {weakSpot.resolved && (
          <RowAction
            tone="quiet"
            onClick={() => onReopen(weakSpot.id)}
            ariaLabel="Reopen this card"
            disabled={isMutating}
          >
            Reopen
          </RowAction>
        )}
      </div>
    </li>
  )
}

// ─── Row action ──────────────────────────────────────────────────────────────

interface RowActionProps {
  tone:       'primary' | 'quiet'
  onClick:    () => void
  ariaLabel:  string
  disabled?:  boolean
  children:   React.ReactNode
}

function RowAction({
  tone,
  onClick,
  ariaLabel,
  disabled = false,
  children,
}: RowActionProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onClick()
      }}
      aria-label={ariaLabel}
      disabled={disabled}
      className={[
        'rounded-[2px] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        tone === 'primary'
          ? 'bg-sumi-ink text-warm-paper-base hover:bg-sumi-ink/85'
          : 'border border-soft-hairline text-faded-sumi hover:border-sumi-ink hover:text-sumi-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jlptPillTone(level: string): JlptPillLevel {
  if (level === 'N1' || level === 'N2' || level === 'N3' || level === 'N4' || level === 'N5') {
    return level
  }
  if (level === 'beyond_jlpt') return 'beyond_jlpt'
  return 'beyond_jlpt'
}

function formatRelativeDays(days: number): string {
  if (days <= 0)  return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14)  return `${days}d ago`
  if (days < 60)  return `${Math.round(days / 7)}w ago`
  return `${Math.round(days / 30)}mo ago`
}
