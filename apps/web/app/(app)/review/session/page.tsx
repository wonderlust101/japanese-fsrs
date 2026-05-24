'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter }                            from 'next/navigation'
import { useShallow }                           from 'zustand/react/shallow'

import { ReviewCard }                      from '@/components/review/ReviewCard'
import { Button }                          from '@/components/ui/Button'
import { SectionCard }                     from '@/components/ui/SectionCard'
import { PageLoader }                      from '@/components/ui/TomoLoader'
import { EndSessionConfirmDialog }         from './_components/end-session-confirm-dialog'
import { useSubmitReview, useOfflineSync, useDueCards } from '@/lib/api/reviews'
import { useDecks }                        from '@/lib/api/decks'
import { getProfileAction }                from '@/lib/actions/profile.actions'
import { buildDashboardCalendarContext }   from '@/app/(app)/today/_components/today-calendar'
import { useSessionTuningStore }           from '@/stores/useSessionTuningStore'
import {
  useCurrentCard,
  useIsSessionStarted,
  useSessionHistory,
  useSessionId,
  useSessionActions,
} from '@/stores/useReviewSessionStore'
import { useSessionDevOverrides } from '@/stores/useSessionDevOverridesStore'

import { classifyCard, priorityForKind } from '@/lib/review/queue-classify'
import { rememberLastFinishedSession } from '@/lib/review/last-finished-session'

import { useReviewSessionDevState } from '@/dev/panels/review-session'

import { UndoPill }            from './_components/undo-pill'

import type { SubmitReviewInput } from '@fsrs-japanese/shared-types'

// How long a just-submitted rating stays undoable. Within this window the
// API mutation hasn't fired yet, so undo is "cancel" rather than "rollback."
const UNDO_WINDOW_MS = 3000

interface PendingSubmission {
  payload:    SubmitReviewInput
  isLastCard: boolean
}

export default function ReviewSessionPage(): React.JSX.Element | null {
  const router         = useRouter()
  const isStarted      = useIsSessionStarted()
  const currentCard    = useCurrentCard()
  const sessionHistory = useSessionHistory()
  const sessionId      = useSessionId()
  const { startSession, endSession, undoLastRating, attachReviewLogId } = useSessionActions()
  const { mutate: submitReview, isError } = useSubmitReview()
  const [hasSyncError, setHasSyncError] = useState(false)
  const [bootstrapFailed, setBootstrapFailed] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false)
  const processedRef   = useRef(0)
  const cardShownAtRef = useRef<number>(Date.now())

  // Deferred-submit + undo state. Bounded to a single pending entry; the
  // next rating flushes the prior one before scheduling its own timer.
  const [pendingGeneration, setPendingGeneration] = useState(0)
  const [canUndo, setCanUndo] = useState(false)
  const pendingPayloadRef = useRef<PendingSubmission | null>(null)
  const pendingTimerRef   = useRef<number | null>(null)

  const overrides = useSessionDevOverrides()

  // Register the session dev panel with the global dock. No render needed —
  // the dock owns the chrome and the panel body wires to Zustand directly.
  useReviewSessionDevState()

  useOfflineSync()

  // ── Bootstrap: if no session, try to start one from cached due cards using
  // the current session tuning. Driven by the IA decision that Today's
  // primary CTA navigates directly here, with /review/setup reserved as the
  // optional customization detour.
  const dueQuery   = useDueCards()
  const decksQuery = useDecks(50)

  // We need the calendar context for backlog classification. The session page
  // is a client component, so we resolve timezone lazily; SSR-good defaults
  // are fine because classification only matters once dueQuery resolves.
  const [tz, setTz] = useState<string | undefined>(undefined)
  const [todayKey, setTodayKey] = useState<string | undefined>(undefined)
  // Ref guard so StrictMode's double-mount (dev) doesn't fire getProfileAction
  // twice; the ref persists across the remount where `cancelled` does not.
  const profileFetchedRef = useRef(false)
  useEffect(() => {
    if (profileFetchedRef.current) return
    profileFetchedRef.current = true
    let cancelled = false
    void getProfileAction().then((profile) => {
      if (cancelled) return
      const cal = buildDashboardCalendarContext(new Date(), profile?.timezone)
      setTz(cal.timeZone)
      setTodayKey(cal.todayKey)
    })
    return () => { cancelled = true }
  }, [])

  // useShallow: fresh object literal would otherwise cause an infinite render
  // loop via useSyncExternalStore.
  const tuning = useSessionTuningStore(useShallow((s) => ({
    includeNewCards: s.includeNewCards,
    sessionSize:     s.sessionSize,
    includedDeckIds: s.includedDeckIds,
    reviewOrder:     s.reviewOrder,
    newCardOrder:    s.newCardOrder,
    overdueFirst:    s.overdueFirst,
    timeboxMinutes:  s.timeboxMinutes,
  })))

  const queuedCards = useMemo(() => {
    if (isStarted) return []
    if (dueQuery.data === undefined) return []
    if (todayKey === undefined || tz === undefined) return []
    const dueItems    = dueQuery.data.items
    const allDeckIds  = new Set((decksQuery.data?.items ?? []).map((d) => d.id))
    const allowedIds  = tuning.includedDeckIds === null ? allDeckIds : new Set(tuning.includedDeckIds)

    let pool = dueItems.filter((c) => c.deckId !== null && allowedIds.has(c.deckId))
    if (!tuning.includeNewCards) pool = pool.filter((c) => c.state !== 0)
    if (tuning.overdueFirst && todayKey !== undefined && tz !== undefined) {
      const tk = todayKey, tzz = tz
      pool = pool.filter((c) => classifyCard(c, tk, tzz) === 'backlog')
    }
    if (tuning.reviewOrder === 'shuffle') {
      pool = [...pool].sort(() => Math.random() - 0.5)
    } else if (todayKey !== undefined && tz !== undefined) {
      const tk = todayKey, tzz = tz
      pool = [...pool].sort((a, b) => {
        const ka = classifyCard(a, tk, tzz)
        const kb = classifyCard(b, tk, tzz)
        return priorityForKind(ka) - priorityForKind(kb)
      })
    }
    if (tuning.sessionSize > 0) pool = pool.slice(0, tuning.sessionSize)
    if (tuning.timeboxMinutes !== null) {
      const budget = tuning.timeboxMinutes * 60
      const result: typeof pool = []
      let used = 0
      for (const c of pool) {
        const cost = c.state === 0 ? 25 : 15
        if (used + cost > budget) break
        result.push(c)
        used += cost
      }
      pool = result
    }
    return pool
  }, [isStarted, dueQuery.data, decksQuery.data, todayKey, tz, tuning])

  // Bootstrap the session once data is ready; redirect when there's nothing to do.
  useEffect(() => {
    if (isStarted) return
    if (dueQuery.isLoading || decksQuery.isLoading) return
    if (todayKey === undefined || tz === undefined) return
    if (dueQuery.isError) { setBootstrapFailed(true); return }
    if (queuedCards.length === 0) {
      // Skip the redirect when dev tools are forcing a state — designers may
      // want to land on /review/session and seed a fixture from the dock.
      if (overrides.forceBootstrapFailed) return
      if (process.env.NODE_ENV !== 'production') return
      router.replace('/review/setup')
      return
    }
    startSession([...queuedCards])
  }, [isStarted, dueQuery.isLoading, dueQuery.isError, decksQuery.isLoading, todayKey, tz, queuedCards, startSession, router, overrides.forceBootstrapFailed])

  // Flush the pending submission to the API. Cancels the deferred timer
  // and fires submitReview now. Wraps the last-card navigation logic so
  // explicit end-session can flush before navigating away.
  const flushPending = useCallback((): void => {
    const p = pendingPayloadRef.current
    if (p === null) return
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    pendingPayloadRef.current = null
    setCanUndo(false)

    if (p.isLastCard) {
      submitReview(p.payload, {
        onSuccess: (data) => {
          if (data.reviewLogId !== null) {
            attachReviewLogId(p.payload.cardId, data.reviewLogId)
          }
        },
        onSettled: () => {
          if (sessionId !== null) {
            rememberLastFinishedSession({
              sessionId,
              historyCount: sessionHistory.length + 1, // +1: this submission just landed
              endedEarly:   false,
            })
          }
          endSession()
          router.replace(`/review/summary?id=${sessionId}`)
        },
      })
    } else {
      submitReview(p.payload, {
        onSuccess: (data) => {
          if (data.reviewLogId !== null) {
            attachReviewLogId(p.payload.cardId, data.reviewLogId)
          }
        },
      })
    }
  }, [submitReview, endSession, router, sessionId, sessionHistory.length, attachReviewLogId])

  // Cancel the deferred submission entirely and rewind the local session
  // state by one rating. The API call never fires, so no rollback endpoint
  // is needed.
  const handleUndo = useCallback((): void => {
    if (pendingPayloadRef.current === null) return
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    pendingPayloadRef.current = null
    processedRef.current = Math.max(0, processedRef.current - 1)
    setCanUndo(false)
    undoLastRating()
  }, [undoLastRating])

  // End-session is lifted from ReviewCard so it can flush a pending
  // submission before navigating. Without this, the last rated card would
  // remain in the deferred queue when the page unmounts. Routes to the
  // Review Summary (not Today) so an early exit gets the same calm close
  // ritual as a completed session, per the Summary IA brief.
  //
  // One race condition needs explicit handling: a submission inside the
  // 3-second undo window must finish persisting before we navigate, or the
  // summary endpoint sees zero rows for the (client-generated) session_id
  // and the RPC raises `session_not_found`. We flush that pending write
  // with onSettled so navigation waits.
  //
  // Zero-history sessions intentionally still route to the Summary; the
  // Summary page treats `?ended=early` as a forgiving path and renders the
  // ended-early pattern with empty data when the API has nothing to return.
  const handleEndSession = useCallback((): void => {
    const navigateToSummary = (): void => {
      // Persist a tab-scoped handoff before navigating so the Summary
      // page can short-circuit the API on refresh (especially in the
      // empty-history case where the API would 404). Count is measured
      // *before* endSession() resets nothing — sessionHistory survives.
      if (sessionId !== null) {
        rememberLastFinishedSession({
          sessionId,
          historyCount: sessionHistory.length,
          endedEarly:   true,
        })
      }
      endSession()
      if (sessionId !== null) {
        router.push(`/review/summary?id=${sessionId}&ended=early`)
      } else {
        router.push('/today')
      }
    }

    const pending = pendingPayloadRef.current
    if (pending !== null) {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
      pendingPayloadRef.current = null
      setCanUndo(false)
      submitReview(pending.payload, {
        onSuccess: (data) => {
          if (data.reviewLogId !== null) {
            attachReviewLogId(pending.payload.cardId, data.reviewLogId)
          }
        },
        onSettled: navigateToSummary,
      })
      return
    }

    navigateToSummary()
  }, [submitReview, endSession, router, sessionId, sessionHistory.length, attachReviewLogId])

  // Mobile-only confirm escalation: tapping the icon-only End button on
  // mobile routes through a confirm dialog unless the session has no rated
  // cards yet (nothing to lose, no need for friction).
  const handleEndSessionRequest = useCallback((): void => {
    if (sessionHistory.length === 0) {
      handleEndSession()
      return
    }
    setEndDialogOpen(true)
  }, [sessionHistory.length, handleEndSession])

  const handleConfirmEndSession = useCallback((): void => {
    setEndDialogOpen(false)
    handleEndSession()
  }, [handleEndSession])

  // ① When sessionHistory grows, defer the API mutation by UNDO_WINDOW_MS.
  // If a previous deferred submission is still pending, flush it first so
  // submissions stay in order and the queue is bounded at one entry.
  useEffect(() => {
    if (sessionHistory.length <= processedRef.current) return
    const last = sessionHistory.at(-1)
    if (last === undefined) return

    // Dev-fixture cards have non-UUID ids — don't push them to the API.
    if (last.card.id.startsWith('fixture-')) {
      processedRef.current = sessionHistory.length
      return
    }

    if (pendingPayloadRef.current !== null) flushPending()

    processedRef.current = sessionHistory.length
    const reviewTimeMs = Date.now() - cardShownAtRef.current
    const isLastCard   = currentCard === undefined
    const payload: SubmitReviewInput = {
      cardId: last.card.id,
      rating: last.rating,
      reviewTimeMs,
      ...(sessionId !== null ? { sessionId } : {}),
    }

    pendingPayloadRef.current = { payload, isLastCard }
    setPendingGeneration((g) => g + 1)
    setCanUndo(true)
    pendingTimerRef.current = window.setTimeout(() => flushPending(), UNDO_WINDOW_MS)
  }, [sessionHistory, currentCard, sessionId, flushPending])

  // Clean up any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) window.clearTimeout(pendingTimerRef.current)
    }
  }, [])

  // ② Reset card timer after mutation fires (declared after ① so it runs second)
  useEffect(() => {
    if (currentCard !== undefined) {
      cardShownAtRef.current = Date.now()
    }
  }, [currentCard?.id])

  // Track cumulative submission failures so the banner stays visible
  useEffect(() => {
    if (isError) setHasSyncError(true)
  }, [isError])

  const showBootstrapFailed = bootstrapFailed || overrides.forceBootstrapFailed
  const isDev               = process.env.NODE_ENV !== 'production'

  if (showBootstrapFailed) {
    return (
      <StateCard
        stripeTone="error"
        kanji="止"
        label="Couldn't load"
        headline="Something interrupted the session."
        body="Check your connection and try again when you're ready."
        actionLabel="Back to setup"
        onAction={() => router.push('/review/setup')}
      />
    )
  }

  // Bootstrap-in-flight: due/decks queries still resolving, or learner-day
  // calendar values not computed yet. Loader sits in for the otherwise-blank
  // surface so cold loads on a slow connection don't show a stripped page.
  const isBootstrapping =
    overrides.forceBootstrapping ||
    (!isStarted &&
     (dueQuery.isLoading ||
      decksQuery.isLoading ||
      todayKey === undefined ||
      tz       === undefined))

  // End-of-session window: the last card was just rated, queue index has
  // advanced past the end (currentCard undefined), but the deferred submit
  // and route change haven't fired yet. UndoPill still renders so the user
  // keeps the 3s rewind window during the wrap-up.
  const isEndingSession =
    overrides.forceEndingSession ||
    (isStarted && currentCard === undefined && sessionHistory.length > 0)

  if (isBootstrapping) {
    return <PageLoader stageLabels={['Preparing your reviews.']} />
  }

  if (isEndingSession) {
    return (
      <>
        <PageLoader stageLabels={['Wrapping up.']} />
        {canUndo && (
          <UndoPill
            generation={pendingGeneration}
            windowMs={UNDO_WINDOW_MS}
            onUndo={handleUndo}
          />
        )}
      </>
    )
  }

  if (!isStarted || currentCard === undefined) {
    // Dev-only empty state — fixture not seeded yet. In production the
    // bootstrap effect redirects to /review/setup before we land here.
    return isDev ? (
      <StateCard
        stripeTone="aizome"
        kanji="空"
        label="Dev preview"
        headline="No queued cards."
        body="Open the dev dock and seed a fixture queue from Review · Session to preview the surface."
      />
    ) : null
  }

  return (
    <>
      <ReviewCard
        liveSyncError={hasSyncError}
        canUndo={canUndo}
        onUndo={handleUndo}
        onEndSession={handleEndSession}
        onEndSessionRequest={handleEndSessionRequest}
      />
      {canUndo && (
        <UndoPill
          generation={pendingGeneration}
          windowMs={UNDO_WINDOW_MS}
          onUndo={handleUndo}
        />
      )}
      <EndSessionConfirmDialog
        open={endDialogOpen}
        ratedCount={sessionHistory.length}
        onClose={() => setEndDialogOpen(false)}
        onConfirm={handleConfirmEndSession}
      />
    </>
  )
}

// Empty / error states reuse the same SectionCard chrome as the live review
// surface so the stripe-tone-by-state pattern feels native, not bolted on.
function StateCard({
  stripeTone,
  kanji,
  label,
  headline,
  body,
  actionLabel,
  onAction,
}: {
  stripeTone: 'brand' | 'aizome' | 'error'
  kanji:      string
  label:      string
  headline:   string
  body:       string
  actionLabel?: string
  onAction?:    () => void
}): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-4 md:px-6">
      <SectionCard kanji={kanji} label={label} stripeTone={stripeTone}>
        <div className="px-1 py-4 md:px-2 md:py-6 text-center">
          <h1 className="font-display text-2xl md:text-3xl font-medium text-sumi-ink">{headline}</h1>
          <p className="mt-3 text-sm md:text-base text-faded-sumi leading-relaxed max-w-measure mx-auto">
            {body}
          </p>
          {actionLabel !== undefined && onAction !== undefined && (
            <Button
              variant="secondary"
              size="md"
              onClick={onAction}
              className="mt-6"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
