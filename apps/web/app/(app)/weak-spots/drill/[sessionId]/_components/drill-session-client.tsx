'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { PageLoader } from '@/components/ui/TomoLoader'
import { Toast, useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { SessionTopBar } from '@/app/(app)/review/session/_components/session-top-bar'
import { SessionOverlay } from '@/app/(app)/_components/session-overlay'
import {
  useDrillSessionQuery,
  useFinishDrillSessionMutation,
  useAbortDrillSessionMutation,
  useRecordDrillAttemptMutation,
} from '@/lib/api/weak-spots'
import { useSubmitReview } from '@/lib/api/reviews'
import { queryKeys } from '@/lib/api/queryKeys'
import {
  useDrillActions,
  useDrillCurrentCard,
  useDrillCurrentIndex,
  useDrillIsActive,
  useDrillQueue,
  useDrillSessionId,
  useDrillShowAnswer,
} from '@/stores/useWeakSpotDrillSessionStore'
import type {
  ApiWeakSpotDrillAttemptResult,
  SubmitReviewInput,
} from '@fsrs-japanese/shared-types'
import { useWeakSpotDrillSessionDevState } from '@/dev/panels/weak-spot-drill-session'

import { DrillCardDisplay } from '../../_components/drill-card-display'
import { DrillRatingBar } from '../../_components/drill-rating-bar'
import { buildDevSessionDetail, isDevSessionId } from '../../_components/drill-fixtures'

// Canonical FSRS rating channels. The drill rating bar deliberately uses a
// different 3-channel set (Missed/Hesitated/Remembered) because drill answers
// don't change the schedule. When the learner explicitly opts into "Count as
// a real review," we surface the full 4-channel set since this *does* hit
// process_review() and update the canonical FSRS state.
type RealReviewRating = SubmitReviewInput['rating']

// When the override succeeds, the queue still needs to advance locally. The
// drill summary distinguishes "rated as drill" from "counted as review" via
// the record's `countedAsReview` flag, so the local attempt is preserved with
// the closest equivalent drill bucket — this is local accounting only, not a
// wire write (the network drill-attempt mutation is skipped on the override
// path).
function mapRealRatingToDrillResult(rating: RealReviewRating): ApiWeakSpotDrillAttemptResult {
  if (rating === 'again') return 'missed'
  if (rating === 'hard')  return 'hesitated'
  return 'remembered'
}

interface DrillSessionClientProps {
  sessionId: string
}

/**
 * Active drill session. Visual 1-to-1 copy of `/review/session`:
 *   - Shared `SessionTopBar` (review's) with drill labels passed in.
 *   - Centered card with the same `pt-14` clearance and the same flat
 *     SectionCard chrome. No practice-sheet wrapper. No attribution mark.
 *   - Fixed bottom rating bar — three channels (Missed / Hesitated /
 *     Remembered) instead of review's four. The only deliberate visual
 *     diff between the two surfaces.
 *
 * The overlay div (`fixed inset-0 z-[var(--z-overlay)] bg-cool-paper-base`) lives in this
 * component, not in a layout file, so the drill summary (a sibling path)
 * inherits the app shell rather than this overlay.
 */
export function DrillSessionClient({
  sessionId,
}: DrillSessionClientProps): React.JSX.Element {
  useWeakSpotDrillSessionDevState()
  const router = useRouter()
  const isDev = isDevSessionId(sessionId)

  // In dev mode, the fixture stands in for the network response so the rest
  // of the component (store seeding, key handlers, frame rendering) is the
  // single live code path. Mutations are skipped because the fixture session
  // id has no row server-side.
  const devDetail = isDev ? buildDevSessionDetail(sessionId) : null

  const sessionQuery = useDrillSessionQuery(isDev ? null : sessionId)
  const localSessionId = useDrillSessionId()
  const isActive       = useDrillIsActive()
  const queue          = useDrillQueue()
  const currentCard    = useDrillCurrentCard()
  const currentIndex   = useDrillCurrentIndex()
  const showAnswer     = useDrillShowAnswer()
  const actions        = useDrillActions()

  const recordMutation = useRecordDrillAttemptMutation()
  const finishMutation = useFinishDrillSessionMutation()
  const abortMutation  = useAbortDrillSessionMutation()
  const submitReviewMutation = useSubmitReview()
  const queryClient    = useQueryClient()
  const { toast, showToast, dismissToast } = useToast()

  // Override panel state. Opens when the learner clicks "Count this as a real
  // review"; collapses on cancel, on success, or whenever a new card surfaces.
  const [overrideOpen, setOverrideOpen] = useState(false)
  // Lock the override panel while the canonical review submission is in
  // flight so a double-click doesn't fire two reviews for the same card.
  const overrideBusy = submitReviewMutation.isPending

  const queueLength = queue.length
  const reachedEnd  = isActive && currentIndex >= queueLength
  const finishedRef = useRef(false)

  // ── Bootstrap from the server response (or dev fixture) ───────────────────
  useEffect(() => {
    const detail = devDetail ?? sessionQuery.data
    if (detail === undefined || detail === null) return
    if (localSessionId === detail.sessionId && isActive) return
    if (detail.status !== 'active') {
      router.replace(`/weak-spots/drill/${sessionId}/summary`)
      return
    }
    actions.startSession(detail.sessionId, [...detail.cards])
  }, [devDetail, sessionQuery.data, localSessionId, isActive, sessionId, router, actions])

  // ── Auto-finish when the queue exhausts ───────────────────────────────────
  useEffect(() => {
    if (!isActive || !reachedEnd || finishedRef.current) return
    finishedRef.current = true
    if (isDev) {
      actions.endSession(false)
      router.replace(`/weak-spots/drill/${sessionId}/summary`)
      return
    }
    finishMutation.mutate(sessionId, {
      onSettled: () => {
        actions.endSession(false)
        router.replace(`/weak-spots/drill/${sessionId}/summary`)
      },
    })
  }, [isActive, reachedEnd, sessionId, finishMutation, actions, router, isDev])

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  const handleRate = useCallback(
    (result: ApiWeakSpotDrillAttemptResult) => {
      if (!isActive || !showAnswer) return
      const record = actions.recordAttempt(result, false)
      if (record === null) return
      if (isDev) return
      recordMutation.mutate({
        sessionId,
        input: {
          eventId:        record.eventId,
          sessionCardId:  record.sessionCardId,
          result:         record.result,
          shownAt:        record.shownAt,
          answeredAt:     record.answeredAt,
          responseTimeMs: record.responseTimeMs,
        },
      })
    },
    [isActive, showAnswer, actions, recordMutation, sessionId, isDev],
  )

  const handleReveal = useCallback(() => {
    if (!isActive || showAnswer) return
    actions.flipCard()
  }, [isActive, showAnswer, actions])

  // ── Real-review override ──────────────────────────────────────────────────
  //
  // Spec §"Explicit Real-Review Override" lines 482-491: the learner can opt
  // an answer into the canonical schedule. We:
  //   1. Submit a fresh canonical review via the existing mutation — this
  //      hits process_review() and produces a real `review_logs` row.
  //   2. Advance the local drill queue with countedAsReview=true so the
  //      drill summary can label the card distinctly without a wire write.
  //   3. Skip the drill-attempt network mutation for this card so we don't
  //      pollute `weak_spot_drill_attempts` with a marker we can't tell
  //      apart server-side.
  //   4. Invalidate the weak-spots query family so the unresolved count
  //      badge updates (a canonical review may resolve this weak spot or
  //      flag a new one inside the RPC).
  // Errors keep the panel open and surface via the global toast queue; the
  // mutation's onError already enqueues for offline retry.

  const handleSubmitAsReview = useCallback(
    (rating: RealReviewRating) => {
      if (!isActive) return
      if (currentCard === undefined) return
      const cardId = currentCard.cardId
      if (cardId === null) {
        showToast("This card has been deleted and can't be counted as a review.", 'error')
        return
      }
      if (isDev) {
        actions.recordAttempt(mapRealRatingToDrillResult(rating), true)
        setOverrideOpen(false)
        showToast('Counted as a real review.', 'info')
        return
      }
      submitReviewMutation.mutate(
        { cardId, rating },
        {
          onSuccess: () => {
            actions.recordAttempt(mapRealRatingToDrillResult(rating), true)
            setOverrideOpen(false)
            void queryClient.invalidateQueries({ queryKey: queryKeys.weakSpots.all() })
            showToast('Counted as a real review.', 'info')
          },
          onError: (err) => {
            showToast(err.message ?? "Couldn't submit that review.", 'error')
          },
        },
      )
    },
    [
      isActive,
      currentCard,
      isDev,
      actions,
      submitReviewMutation,
      queryClient,
      showToast,
    ],
  )

  const handleOpenOverride = useCallback(() => {
    if (!isActive || !showAnswer || overrideBusy) return
    setOverrideOpen(true)
  }, [isActive, showAnswer, overrideBusy])

  const handleCancelOverride = useCallback(() => {
    if (overrideBusy) return
    setOverrideOpen(false)
  }, [overrideBusy])

  // Collapse the override panel automatically whenever a new card surfaces
  // so a held-open state from card N doesn't carry into card N+1.
  useEffect(() => {
    setOverrideOpen(false)
  }, [currentIndex])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLInputElement) return
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLSelectElement) return
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      if (!isActive) return
      if ((e.key === ' ' || e.key === 'Enter') && !showAnswer) {
        e.preventDefault()
        handleReveal()
        return
      }
      if (!showAnswer) return
      // Override panel hijacks the keymap while open so digits 1-4 map to
      // the canonical rating buttons rather than the drill bar's 1-3.
      if (overrideOpen) {
        if (e.key === 'Escape') { e.preventDefault(); handleCancelOverride() }
        else if (e.key === '1') { e.preventDefault(); handleSubmitAsReview('again') }
        else if (e.key === '2') { e.preventDefault(); handleSubmitAsReview('hard') }
        else if (e.key === '3') { e.preventDefault(); handleSubmitAsReview('good') }
        else if (e.key === '4') { e.preventDefault(); handleSubmitAsReview('easy') }
        return
      }
      if (e.key === '1') { e.preventDefault(); handleRate('missed') }
      else if (e.key === '2') { e.preventDefault(); handleRate('hesitated') }
      else if (e.key === '3') { e.preventDefault(); handleRate('remembered') }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleOpenOverride() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    isActive,
    showAnswer,
    handleReveal,
    handleRate,
    overrideOpen,
    handleOpenOverride,
    handleCancelOverride,
    handleSubmitAsReview,
  ])

  // Reset shown-at when a new card arrives (the store already does this on
  // rate; this useEffect is the safety net for resume / direct-mount cases).
  useEffect(() => {
    if (!isActive) return
    actions.markCardShown()
  }, [currentIndex, isActive, actions])

  // ── End-drill exit ────────────────────────────────────────────────────────
  function handleExit(): void {
    if (!isActive) {
      router.replace('/weak-spots')
      return
    }
    if (isDev) {
      actions.endSession(true)
      router.replace(`/weak-spots/drill/${sessionId}/summary`)
      return
    }
    abortMutation.mutate(sessionId, {
      onSettled: () => {
        actions.endSession(true)
        router.replace(`/weak-spots/drill/${sessionId}/summary`)
      },
    })
  }

  const percentage = queueLength > 0 ? Math.round((currentIndex / queueLength) * 100) : 0

  // ── Loading / error / empty states ────────────────────────────────────────
  if (sessionQuery.isLoading || (!isActive && sessionQuery.data === undefined && devDetail === null)) {
    return (
      <DrillFrame percentage={0} onExit={handleExit}>
        <PageLoader />
      </DrillFrame>
    )
  }

  if (sessionQuery.isError) {
    return (
      <DrillFrame percentage={0} onExit={handleExit}>
        <CenteredCard stripeTone="error">
          <h1 className="font-display text-2xl text-sumi-ink">Couldn’t load this drill session.</h1>
          <p className="mt-2 text-sm text-faded-sumi">{sessionQuery.error.message}</p>
          <div className="mt-5">
            <Link
              href="/weak-spots"
              className="font-mono text-sm text-sumi-ink underline-offset-2 hover:underline"
            >
              Back to Weak spots →
            </Link>
          </div>
        </CenteredCard>
      </DrillFrame>
    )
  }

  if (queueLength === 0) {
    return (
      <DrillFrame percentage={0} onExit={handleExit}>
        <CenteredCard kanji="空" label="Nothing to drill">
          <p className="text-sm leading-relaxed text-faded-sumi">
            Keep your daily reviews steady; this drill fills only when a card needs extra attention.
          </p>
          <div className="mt-5">
            <Link
              href="/weak-spots"
              className="font-mono text-sm text-sumi-ink underline-offset-2 hover:underline"
            >
              Back to Weak spots →
            </Link>
          </div>
        </CenteredCard>
      </DrillFrame>
    )
  }

  if (currentCard === undefined) {
    return (
      <DrillFrame percentage={100} onExit={handleExit}>
        <p className="text-center text-sm text-faded-sumi">Wrapping up…</p>
      </DrillFrame>
    )
  }

  return (
    <DrillFrame percentage={percentage} onExit={handleExit}>
      <div className="mx-auto w-full max-w-[680px]">
        <DrillCardDisplay card={currentCard} showAnswer={showAnswer} />
      </div>

      {!showAnswer && (
        <div className="mx-auto mt-5 flex w-full max-w-[680px] justify-center">
          <Button type="button" variant="primary" size="md" onClick={handleReveal}>
            Show answer · Space
          </Button>
        </div>
      )}

      {showAnswer && !overrideOpen && (
        <>
          <DrillRatingBar onRate={handleRate} />
          {/* The override link sits just above the fixed rating bar. We use
              a fixed-position strip rather than inline flow so the link
              tracks the rating bar at the bottom of the viewport on
              short screens too. */}
          <div className="pointer-events-none fixed inset-x-0 bottom-22 z-[var(--z-bar)] flex justify-center px-4">
            <span className="pointer-events-auto">
              <QuietLink
                tone="sumi"
                size="sm"
                trailingArrow
                onClick={handleOpenOverride}
                ariaLabel="Count this drill answer as a real review (R)"
              >
                Count this as a real review
              </QuietLink>
            </span>
          </div>
        </>
      )}

      {showAnswer && overrideOpen && (
        <RealReviewConfirmBar
          onRate={handleSubmitAsReview}
          onCancel={handleCancelOverride}
          busy={overrideBusy}
        />
      )}

      {toast !== null && (
        <Toast
          key={toast.key}
          message={toast.message}
          kind={toast.kind}
          onDismiss={dismissToast}
        />
      )}
    </DrillFrame>
  )
}

// ── Frame ────────────────────────────────────────────────────────────────────
//
// The fixed-overlay wrapper lives here rather than in a layout.tsx so the
// sibling /summary path doesn't inherit the overlay. Mirrors review's
// session/layout.tsx structure (`fixed inset-0 z-[var(--z-overlay)] bg-cool-paper-base
// overflow-y-auto`) but applied at the page level.

interface DrillFrameProps {
  percentage: number
  onExit:     () => void
  children:   React.ReactNode
}

function DrillFrame({ percentage, onExit, children }: DrillFrameProps): React.JSX.Element {
  return (
    <SessionOverlay>
      <SessionTopBar
        eyebrowLabel="Drill · Practice only"
        endLabel="End drill"
        onEndSession={onExit}
        percentage={percentage}
        offline={false}
        syncError={false}
      />
      <div className="flex flex-1 flex-col items-stretch justify-center pt-14 pb-32 px-4 sm:px-6 lg:pt-14">
        {children}
      </div>
    </SessionOverlay>
  )
}

// Local error/empty state wrapper that mirrors review's `StateCard` chrome
// so loading, error, and empty states share the same silhouette as the
// active card.

function CenteredCard({
  kanji = '',
  label = '',
  stripeTone = 'brand',
  children,
}: {
  kanji?:      string
  label?:      string
  stripeTone?: 'brand' | 'aizome' | 'error'
  children:    React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[680px]">
      <SectionCard
        kanji={kanji}
        label={label}
        stripeTone={stripeTone}
        omitTitle={kanji === '' && label === ''}
      >
        <div className="px-1 py-4 md:px-2 md:py-6">
          {children}
        </div>
      </SectionCard>
    </div>
  )
}

// ── Real-review confirm bar ─────────────────────────────────────────────────
// 4-channel rating row used only when the learner has explicitly opted into
// "Count this as a real review." Visual chrome mirrors the drill rating bar
// (fixed bottom strip, accent-fill buttons) but uses the canonical FSRS
// rating tokens + labels — the spec is firm that real-review semantics must
// not be visually masqueraded as drill ratings.

interface RealRatingSpec {
  value: RealReviewRating
  label: string
  key:   string
  fill:  string
}

const REAL_RATINGS: readonly RealRatingSpec[] = [
  { value: 'again', label: 'Again', key: '1', fill: 'var(--color-rating-again)' },
  { value: 'hard',  label: 'Hard',  key: '2', fill: 'var(--color-rating-hard)'  },
  { value: 'good',  label: 'Good',  key: '3', fill: 'var(--color-rating-good)'  },
  { value: 'easy',  label: 'Easy',  key: '4', fill: 'var(--color-rating-easy)'  },
] as const

interface RealReviewConfirmBarProps {
  onRate:   (rating: RealReviewRating) => void
  onCancel: () => void
  busy:     boolean
}

function RealReviewConfirmBar({
  onRate,
  onCancel,
  busy,
}: RealReviewConfirmBarProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label="Submit as real review"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[var(--z-bar)]',
        'bg-warm-paper-raised border-t border-soft-hairline/60',
        'px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
      )}
    >
      <div className="mx-auto flex max-w-[640px] flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-sm text-faded-sumi">
            Counts as a real review — updates your schedule
          </p>
          <QuietLink
            tone="sumi"
            size="sm"
            onClick={onCancel}
            ariaLabel="Cancel and return to drill rating"
          >
            Cancel · Esc
          </QuietLink>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {REAL_RATINGS.map((spec) => (
            <button
              key={spec.value}
              type="button"
              onClick={() => onRate(spec.value)}
              disabled={busy}
              aria-label={`${spec.label} (press ${spec.key})`}
              aria-keyshortcuts={spec.key}
              style={{ backgroundColor: spec.fill, borderColor: spec.fill }}
              className={cn(
                'group relative flex flex-col items-center justify-center gap-0.5',
                'h-16 rounded-md border px-3',
                'text-warm-paper-raised',
                'transition-[filter,transform] duration-200 ease-out',
                'cursor-pointer hover:brightness-95 active:translate-y-[1px]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
                'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0',
              )}
            >
              <span className="font-medium text-sm md:text-base leading-none tracking-tight">
                {spec.label}
              </span>
              <span
                aria-hidden="true"
                className="font-mono text-sm tabular-nums leading-none text-warm-paper-raised/70"
              >
                {spec.key}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
