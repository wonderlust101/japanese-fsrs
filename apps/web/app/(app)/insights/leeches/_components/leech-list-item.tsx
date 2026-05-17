'use client'

import { useRouter } from 'next/navigation'

import { FuriganaText } from '@/components/ui/FuriganaText'
import { Pill, type JlptPillLevel } from '@/components/ui/Pill'
import type { ApiLeechListItem } from '@fsrs-japanese/shared-types'

interface LeechListItemProps {
  leech:       ApiLeechListItem
  onOpen:      (leechId: string) => void
  onResolve:   (leechId: string) => void
  onReopen:    (leechId: string) => void
  isMutating:  boolean
}

/**
 * Single leech row. Anatomy ordered top-down:
 *
 *   1. Japanese hero — word with optional furigana, meaning aside.
 *   2. Metadata strip — deck · modality · JLPT pill · lapses · last review.
 *   3. Diagnosis status — small editorial note when present.
 *   4. Row actions — Drill / View / Resolve (or Reopen for resolved rows).
 *
 * Orphan rows (`cardId === null` and word/reading/meaning all null) render a
 * dimmed "card no longer exists" line — the doc explicitly preserves leech
 * history even after card deletion, so the row must not crash on missing
 * fields, but it also must clearly communicate that drilling/resolving in
 * the live way isn't possible. For now those rows only expose the inert
 * "View details" path; Drill and Resolve are hidden.
 *
 * Row container is the clickable element. The action cluster uses
 * `event.stopPropagation()` so clicking Drill/Resolve doesn't also open the
 * detail dialog.
 */
export function LeechListItem({
  leech,
  onOpen,
  onResolve,
  onReopen,
  isMutating,
}: LeechListItemProps): React.JSX.Element {
  const router       = useRouter()
  const isOrphan     = leech.cardId === null
  const lapseCount   = leech.lapses ?? 0
  const lastReviewMs = leech.lastReview === null ? null : Date.parse(leech.lastReview)
  const lastReviewLabel =
    lastReviewMs === null
      ? null
      : formatRelativeDays(Math.round((Date.now() - lastReviewMs) / 86_400_000))
  const detectedMs   = Date.parse(leech.createdAt)
  const detectedLabel = formatRelativeDays(Math.round((Date.now() - detectedMs) / 86_400_000))
  const hasDiagnosis = leech.diagnosis !== null && leech.diagnosis !== ''

  const cardTypeLabel = CARD_TYPE_LABEL[leech.cardType ?? 'comprehension'] ?? 'Comprehension'

  return (
    <li className="group relative flex flex-col gap-y-3 border-b border-soft-hairline px-4 py-4 last:border-b-0 sm:px-5 sm:py-5">
      {/* Hero row — clickable text area opens the detail dialog */}
      <button
        type="button"
        onClick={() => onOpen(leech.id)}
        className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-display text-[1.0625rem] leading-tight text-sumi-ink sm:text-[1.125rem]">
            {leech.word !== null && leech.reading !== null ? (
              <FuriganaText text={leech.word} reading={leech.reading} />
            ) : (
              <span className={isOrphan ? 'italic text-faded-sumi' : ''}>
                {leech.word ?? 'Card no longer exists'}
              </span>
            )}
          </span>
          {leech.meaning !== null && (
            <span className="text-sm text-faded-sumi">{leech.meaning}</span>
          )}
        </div>
      </button>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span>
          <span className="tabular-nums text-sumi-ink/85">{lapseCount}</span>{' '}
          {lapseCount === 1 ? 'lapse' : 'lapses'}
        </span>
        {leech.deckName !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate normal-case tracking-normal">{leech.deckName}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>{cardTypeLabel}</span>
        {leech.jlptLevel !== null && (
          <>
            <span aria-hidden="true">·</span>
            <Pill
              variant="level"
              tone={jlptPillTone(leech.jlptLevel)}
              size="sm"
            >
              {leech.jlptLevel === 'beyond_jlpt' ? 'Beyond' : leech.jlptLevel}
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
        {leech.resolved && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-aizome-indigo">Resolved</span>
          </>
        )}
      </div>

      {/* Diagnosis status — editorial line */}
      {hasDiagnosis ? (
        <p className="max-w-prose text-[0.8125rem] italic leading-relaxed text-sumi-ink/85">
          {leech.diagnosis}
        </p>
      ) : !isOrphan && !leech.resolved ? (
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi/85">
          Diagnosis · not requested yet
        </p>
      ) : null}

      {/* Action cluster */}
      <div className="flex flex-wrap items-center gap-2">
        {!isOrphan && !leech.resolved && (
          <RowAction
            tone="primary"
            onClick={() => router.push(`/cards/${leech.cardId}/repair`)}
            ariaLabel={`Drill ${leech.word ?? 'this leech'}`}
          >
            Drill
          </RowAction>
        )}
        <RowAction
          tone="quiet"
          onClick={() => onOpen(leech.id)}
          ariaLabel="View details"
        >
          View details
        </RowAction>
        {!isOrphan && !leech.resolved && (
          <RowAction
            tone="quiet"
            onClick={() => onResolve(leech.id)}
            ariaLabel={`Mark ${leech.word ?? 'this leech'} resolved`}
            disabled={isMutating}
          >
            Mark resolved
          </RowAction>
        )}
        {leech.resolved && (
          <RowAction
            tone="quiet"
            onClick={() => onReopen(leech.id)}
            ariaLabel="Reopen this leech"
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

const CARD_TYPE_LABEL: Record<string, string> = {
  comprehension: 'Comprehension',
  production:    'Production',
  listening:     'Listening',
}

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
