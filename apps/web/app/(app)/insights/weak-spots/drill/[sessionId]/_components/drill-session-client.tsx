'use client'

import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  useDrillSessionQuery,
  useFinishDrillSessionMutation,
  useAbortDrillSessionMutation,
  useRecordDrillAttemptMutation,
} from '@/lib/api/leeches'
import {
  useDrillActions,
  useDrillCurrentCard,
  useDrillCurrentIndex,
  useDrillIsActive,
  useDrillQueue,
  useDrillSessionId,
  useDrillShowAnswer,
} from '@/stores/useLeechDrillSessionStore'
import type { ApiLeechDrillAttemptResult } from '@fsrs-japanese/shared-types'

import { DrillCardDisplay } from '../../_components/drill-card-display'
import { DrillRatingBar } from '../../_components/drill-rating-bar'

interface DrillSessionClientProps {
  sessionId: string
}

/**
 * Active drill session. Mirrors the review-session orchestration but
 * isolates state in `useLeechDrillSessionStore`:
 *
 *   - Loads the session detail via TanStack Query on mount; primes the
 *     local Zustand store when the data resolves (or when the local store
 *     was hydrated from a prior tab and matches the URL id).
 *   - Owns the reveal / rate cycle. Reveal uses `Space` or `Enter`.
 *     Ratings use 1 (Missed), 2 (Hesitated), 3 (Remembered).
 *   - Per attempt, fires the `POST /attempts` mutation in the background.
 *     The store's eventId is the idempotency key — a retry returns the
 *     original row without a second insert. We don't block UI on the
 *     network: the next card paints immediately.
 *   - When the queue is exhausted, calls `finishDrillSession` and routes
 *     to the summary page. If the learner exits early, the abort mutation
 *     fires from the End-drill control.
 *
 * Scheduler invariance: this page never calls the canonical review
 * submission path. "Count this as a review" is intentionally deferred to
 * Phase 3 — the doc allows that override but the UI surface is non-trivial
 * (re-rate with the four FSRS channels) and the core drill experience
 * works without it.
 */
export function DrillSessionClient({
  sessionId,
}: DrillSessionClientProps): React.JSX.Element {
  const router = useRouter()

  const sessionQuery = useDrillSessionQuery(sessionId)
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

  const queueLength = queue.length
  const reachedEnd  = isActive && currentIndex >= queueLength
  const finishedRef = useRef(false)

  // ── Bootstrap from the server response ────────────────────────────────────
  useEffect(() => {
    if (sessionQuery.data === undefined) return
    if (localSessionId === sessionQuery.data.sessionId && isActive) return
    if (sessionQuery.data.status !== 'active') {
      // Session is finished/aborted — route to summary; the summary page
      // can read either local store state or refetch via the same query.
      router.replace(`/insights/weak-spots/drill/${sessionId}/summary`)
      return
    }
    actions.startSession(sessionQuery.data.sessionId, [...sessionQuery.data.cards])
  }, [sessionQuery.data, localSessionId, isActive, sessionId, router, actions])

  // ── Auto-finish when the queue exhausts ───────────────────────────────────
  useEffect(() => {
    if (!isActive || !reachedEnd || finishedRef.current) return
    finishedRef.current = true
    finishMutation.mutate(sessionId, {
      onSettled: () => {
        actions.endSession(false)
        router.replace(`/insights/weak-spots/drill/${sessionId}/summary`)
      },
    })
  }, [isActive, reachedEnd, sessionId, finishMutation, actions, router])

  // ── Keyboard handlers ─────────────────────────────────────────────────────
  const handleRate = useCallback(
    (result: ApiLeechDrillAttemptResult) => {
      if (!isActive || !showAnswer) return
      const record = actions.recordAttempt(result, false)
      if (record === null) return
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
    [isActive, showAnswer, actions, recordMutation, sessionId],
  )

  const handleReveal = useCallback(() => {
    if (!isActive || showAnswer) return
    actions.flipCard()
  }, [isActive, showAnswer, actions])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement) return
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLSelectElement) return
      if (!isActive) return
      if ((e.key === ' ' || e.key === 'Enter') && !showAnswer) {
        e.preventDefault()
        handleReveal()
        return
      }
      if (!showAnswer) return
      if (e.key === '1') { e.preventDefault(); handleRate('missed') }
      else if (e.key === '2') { e.preventDefault(); handleRate('hesitated') }
      else if (e.key === '3') { e.preventDefault(); handleRate('remembered') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, showAnswer, handleReveal, handleRate])

  // Reset shown-at when a new card arrives (the store already does this on
  // rate; this useEffect is the safety net for resume / direct-mount cases).
  useEffect(() => {
    if (!isActive) return
    actions.markCardShown()
  }, [currentIndex, isActive, actions])

  // ── End-drill exit ────────────────────────────────────────────────────────
  function handleExit(): void {
    if (!isActive) {
      router.replace('/insights/weak-spots')
      return
    }
    abortMutation.mutate(sessionId, {
      onSettled: () => {
        actions.endSession(true)
        router.replace(`/insights/weak-spots/drill/${sessionId}/summary`)
      },
    })
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (sessionQuery.isLoading || (!isActive && sessionQuery.data === undefined)) {
    return <DrillFrame topBar={<TopBar percentage={0} onExit={handleExit} />}>
      <Skeleton className="mx-auto h-72 w-full max-w-[640px]" />
    </DrillFrame>
  }

  if (sessionQuery.isError) {
    return <DrillFrame topBar={<TopBar percentage={0} onExit={handleExit} />}>
      <div
        role="alert"
        className="mx-auto w-full max-w-[640px] rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
      >
        <p>Couldn’t load this drill session.</p>
        <p className="mt-1 text-error-deep/80">{sessionQuery.error.message}</p>
        <div className="mt-4">
          <Link
            href="/insights/weak-spots"
            className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep underline-offset-2 hover:underline"
          >
            Back to Weak spots →
          </Link>
        </div>
      </div>
    </DrillFrame>
  }

  if (queueLength === 0) {
    return <DrillFrame topBar={<TopBar percentage={0} onExit={handleExit} />}>
      <div className="mx-auto w-full max-w-[640px] rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-5 py-8 text-center">
        <p className="font-display text-xl text-sumi-ink">Nothing to drill right now.</p>
        <p className="mt-2 text-sm leading-relaxed text-faded-sumi">
          Keep your daily reviews steady; this drill fills only when a card needs extra attention.
        </p>
        <div className="mt-6">
          <Link
            href="/insights/weak-spots"
            className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep underline-offset-2 hover:underline"
          >
            Back to Weak spots →
          </Link>
        </div>
      </div>
    </DrillFrame>
  }

  if (currentCard === undefined) {
    // We've consumed the queue — the auto-finish effect is already routing
    // to the summary; render a quiet placeholder while we wait.
    return <DrillFrame topBar={<TopBar percentage={100} onExit={handleExit} />}>
      <p className="text-center text-sm text-faded-sumi">Wrapping up…</p>
    </DrillFrame>
  }

  const percentage = queueLength > 0 ? Math.round((currentIndex / queueLength) * 100) : 0

  return (
    <DrillFrame topBar={<TopBar percentage={percentage} onExit={handleExit} />}>
      <DrillCardDisplay card={currentCard} showAnswer={showAnswer} />

      {!showAnswer && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="primary" size="md" onClick={handleReveal}>
            Show answer · Space
          </Button>
        </div>
      )}

      <PracticeOnlyStrip
        position={currentIndex + 1}
        total={queueLength}
        lapses={currentCard.lapses ?? 0}
      />

      {showAnswer && <DrillRatingBar onRate={handleRate} />}
    </DrillFrame>
  )
}

// ── Frame ────────────────────────────────────────────────────────────────────

interface DrillFrameProps {
  topBar:   React.ReactNode
  children: React.ReactNode
}

function DrillFrame({ topBar, children }: DrillFrameProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col">
      {topBar}
      <div className="flex flex-1 flex-col justify-center px-4 pb-32 pt-6 sm:px-6 lg:pt-10">
        {children}
      </div>
    </div>
  )
}

interface TopBarProps {
  percentage: number
  onExit:     () => void
}

function TopBar({ percentage, onExit }: TopBarProps): React.JSX.Element {
  return (
    <header
      role="banner"
      aria-label="Drill session controls"
      className="border-b border-soft-hairline bg-warm-paper-raised"
    >
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <span
            lang="ja"
            aria-hidden="true"
            className="font-display text-xl leading-none text-inari-vermillion translate-y-[0.05em]"
          >
            弱
          </span>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep">
            Drill · Practice only
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          End drill
        </button>
      </div>
      <div
        role="progressbar"
        aria-label="Drill progress"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-px bg-soft-hairline/40"
      >
        <div
          aria-hidden="true"
          className="h-full bg-inari-vermillion transition-[width] duration-200 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </header>
  )
}

interface PracticeOnlyStripProps {
  position: number
  total:    number
  lapses:   number
}

function PracticeOnlyStrip({
  position,
  total,
  lapses,
}: PracticeOnlyStripProps): React.JSX.Element {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-[640px] flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
      <span>
        Card <span className="tabular-nums text-sumi-ink/85">{position}</span> of{' '}
        <span className="tabular-nums">{total}</span>
      </span>
      <span>
        <span className="tabular-nums text-sumi-ink/85">{lapses}</span>{' '}
        {lapses === 1 ? 'lapse' : 'lapses'}
      </span>
      <span className="text-inari-vermillion-deep">Review schedule unchanged</span>
    </div>
  )
}
