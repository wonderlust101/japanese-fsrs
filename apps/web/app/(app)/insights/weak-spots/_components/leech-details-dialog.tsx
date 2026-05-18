'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FuriganaText } from '@/components/ui/FuriganaText'
import { Pill, type JlptPillLevel } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ApiLeechListItem } from '@fsrs-japanese/shared-types'

import { LeechDiagnosisPanel } from './leech-diagnosis-panel'

interface LeechDetailsDialogProps {
  open:          boolean
  onClose:       () => void
  leech:         ApiLeechListItem | undefined
  isLoading:     boolean
  isError:       boolean
  errorMessage?: string
  onResolve:     (id: string) => void
  onReopen:      (id: string) => void
  onDiagnose:    (id: string) => void
  isResolving:   boolean
  isReopening:   boolean
  isDiagnosing:  boolean
  diagnoseError: string | undefined
}

/**
 * Leech detail surface. Uses the `Dialog` primitive — already brand-aligned
 * with eyebrow + kanji + 2px vermillion top stripe — at the `xl` tier so
 * the card content + FSRS state strip + diagnosis panel all fit without
 * scrolling on a typical viewport.
 *
 * The Dialog stays mounted (open false) when no leech is selected, but the
 * caller passes `leech: undefined` and `isLoading: false` in that case so
 * the body short-circuits to null without firing any query. The detail
 * query in `useLeechDetailQuery` is also `enabled`-gated on the id.
 */
export function LeechDetailsDialog({
  open,
  onClose,
  leech,
  isLoading,
  isError,
  errorMessage,
  onResolve,
  onReopen,
  onDiagnose,
  isResolving,
  isReopening,
  isDiagnosing,
  diagnoseError,
}: LeechDetailsDialogProps): React.JSX.Element {
  const router = useRouter()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={leech?.word ?? 'Weak spot'}
      eyebrow={{ kanji: '弱', label: 'Weak spot' }}
      size="xl"
    >
      {isLoading || leech === undefined ? (
        <DetailSkeleton />
      ) : isError ? (
        <div
          role="alert"
          className="rounded-[2px] border border-error/30 bg-error-tint/40 px-4 py-4 text-sm text-error-deep"
        >
          <p>Couldn&rsquo;t load this card right now.</p>
          {errorMessage !== undefined && (
            <p className="mt-1 text-error-deep/80">{errorMessage}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-y-6">
          {/* Hero card body */}
          <section
            aria-label="Card content"
            className="rounded-[2px] border border-soft-hairline bg-cream-inset/45 px-4 py-4 sm:px-5 sm:py-5"
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
              <span className="font-display text-2xl text-sumi-ink sm:text-[1.625rem]">
                {leech.word !== null && leech.reading !== null ? (
                  <FuriganaText text={leech.word} reading={leech.reading} />
                ) : (
                  <span className="italic text-faded-sumi">Card no longer exists</span>
                )}
              </span>
              {leech.jlptLevel !== null && (
                <Pill variant="level" tone={jlptPillTone(leech.jlptLevel)} size="sm">
                  {leech.jlptLevel === 'beyond_jlpt' ? 'Beyond' : leech.jlptLevel}
                </Pill>
              )}
            </div>
            {leech.meaning !== null && (
              <p className="mt-2 text-base text-sumi-ink/85">{leech.meaning}</p>
            )}
          </section>

          {/* FSRS state strip */}
          <section
            aria-label="Card state"
            className="grid grid-cols-2 gap-y-3 gap-x-4 border-y border-soft-hairline py-4 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi sm:grid-cols-4"
          >
            <StateCell label="Lapses" value={leech.lapses === null ? '—' : String(leech.lapses)} />
            <StateCell label="Reps"   value={leech.reps   === null ? '—' : String(leech.reps)}   />
            <StateCell label="Last review" value={formatDate(leech.lastReview)} />
            <StateCell label="Due"   value={formatDate(leech.due)} />
            <StateCell label="Deck"  value={leech.deckName ?? '—'} normalCase />
            <StateCell label="Modality" value={CARD_TYPE_LABEL[leech.cardType ?? 'comprehension'] ?? 'Comprehension'} />
            <StateCell label="Flagged" value={formatDate(leech.createdAt)} />
            <StateCell
              label="Status"
              value={leech.resolved ? 'Resolved' : 'Unresolved'}
              tone={leech.resolved ? 'aizome' : 'sumi'}
            />
          </section>

          {/* Diagnosis */}
          <LeechDiagnosisPanel
            diagnosis={leech.diagnosis}
            prescription={leech.prescription}
            isLoading={isDiagnosing}
            isError={diagnoseError !== undefined}
            {...(diagnoseError !== undefined ? { errorMessage: diagnoseError } : {})}
            onDiagnose={() => onDiagnose(leech.id)}
            onRetry={() => onDiagnose(leech.id)}
          />

          {/* Footer actions */}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-soft-hairline pt-5">
            <div className="flex flex-wrap items-center gap-2">
              {!leech.resolved && leech.cardId !== null && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    router.push(`/insights/weak-spots/drill/setup?cardId=${leech.cardId}`)
                  }
                >
                  Drill this card
                </Button>
              )}
              {leech.cardId !== null && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/cards/${leech.cardId}`)}
                >
                  Open card
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!leech.resolved ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolve(leech.id)}
                  loading={isResolving}
                  disabled={leech.cardId === null}
                >
                  Mark resolved
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onReopen(leech.id)}
                  loading={isReopening}
                >
                  Reopen
                </Button>
              )}
            </div>
          </footer>
        </div>
      )}
    </Dialog>
  )
}

// ─── State cells / skeleton / helpers ────────────────────────────────────────

interface StateCellProps {
  label:     string
  value:     string
  tone?:     'sumi' | 'aizome'
  normalCase?: boolean
}

function StateCell({
  label,
  value,
  tone = 'sumi',
  normalCase = false,
}: StateCellProps): React.JSX.Element {
  return (
    <div>
      <p className="text-[0.625rem]">{label}</p>
      <p
        className={[
          'mt-1 font-mono text-[0.875rem]',
          tone === 'aizome' ? 'text-aizome-indigo' : 'text-sumi-ink',
          normalCase ? 'tracking-normal normal-case' : 'tabular-nums',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function DetailSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" aria-label="Loading leech" className="flex flex-col gap-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <Skeleton className="h-28 w-full" />
    </div>
  )
}

const CARD_TYPE_LABEL: Record<string, string> = {
  comprehension: 'Comprehension',
  production:    'Production',
  listening:     'Listening',
}

function jlptPillTone(level: string): JlptPillLevel {
  if (level === 'N1' || level === 'N2' || level === 'N3' || level === 'N4' || level === 'N5') {
    return level
  }
  return 'beyond_jlpt'
}

function formatDate(iso: string | null): string {
  if (iso === null) return '—'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
