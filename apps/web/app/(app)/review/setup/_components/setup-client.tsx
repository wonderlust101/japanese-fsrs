'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'

import type { ApiDueCard, ApiDeck } from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { MobileStickyActionBar } from '@/app/(app)/_components/mobile-sticky-action-bar'
import { cn } from '@/lib/utils'
import { inferDeckLevel } from '@/lib/deck-level'
import { useDecks } from '@/lib/api/decks'
import { useDueCards } from '@/lib/api/reviews'
import { useSessionActions } from '@/stores/useReviewSessionStore'
import {
  useSessionTuningStore,
  tuningIsModified,
  type SessionTuning,
} from '@/stores/useSessionTuningStore'

import {
  classifyCard,
  countQueueBreakdown,
  priorityForKind,
  type QueueBreakdown,
} from '@/lib/review/queue-classify'
import {
  estimateSessionSeconds,
  formatSessionEstimate,
} from '@/lib/review/estimate-time'

import { SetupSummary } from './setup-summary'
import { SetupControls } from './setup-controls'
import type { DeckRow } from './setup-deck-list'
import {
  SetupDevToolbar,
  DEFAULT_SETUP_DEV_CONTROLS,
  type SetupDevControls,
} from './setup-dev-toolbar'
import { buildPreviewSnapshot } from './setup-preview-data'

const REVIEW_DEV_TOOLS_TOGGLE_EVENT = 'tomo:review-dev-tools:toggle'
const PREVIEW_ENABLED = process.env.NODE_ENV !== 'production'

interface SetupClientProps {
  initialTodayKey: string
  initialTimeZone: string
}

export function SetupClient({
  initialTodayKey,
  initialTimeZone,
}: SetupClientProps): React.JSX.Element {
  const router            = useRouter()
  const { startSession }  = useSessionActions()

  // ── Tuning state ─────────────────────────────────────────────────────────
  const tuning = useSessionTuningStore(useShallow((s): SessionTuning => ({
    includeNewCards: s.includeNewCards,
    sessionSize:     s.sessionSize,
    includedDeckIds: s.includedDeckIds,
    reviewOrder:     s.reviewOrder,
    newCardOrder:    s.newCardOrder,
    overdueFirst:    s.overdueFirst,
    timeboxMinutes:  s.timeboxMinutes,
    buryRelated:     s.buryRelated,
  })))
  const tuningActions = useSessionTuningStore((s) => s.actions)
  const modified      = tuningIsModified(tuning)

  // ── Dev toolbar ──────────────────────────────────────────────────────────
  const [devControls, setDevControls]   = useState<SetupDevControls>(DEFAULT_SETUP_DEV_CONTROLS)
  const [devToolsOpen, setDevToolsOpen] = useState<boolean>(false)
  useEffect(() => {
    if (!PREVIEW_ENABLED) return
    function handleToggle(): void { setDevToolsOpen((o) => !o) }
    window.addEventListener(REVIEW_DEV_TOOLS_TOGGLE_EVENT, handleToggle)
    return () => window.removeEventListener(REVIEW_DEV_TOOLS_TOGGLE_EVENT, handleToggle)
  }, [])
  useEffect(() => {
    if (!devToolsOpen) return
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setDevToolsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [devToolsOpen])
  const previewActive   = PREVIEW_ENABLED && devToolsOpen
  const previewSnapshot = useMemo(
    () => previewActive ? buildPreviewSnapshot(devControls.state, devControls.queueShape) : null,
    [previewActive, devControls.state, devControls.queueShape],
  )

  // ── Online detection ─────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState<boolean>(true)
  useEffect(() => {
    function update(): void { setIsOnline(navigator.onLine) }
    update()
    window.addEventListener('online',  update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online',  update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // ── Live data ────────────────────────────────────────────────────────────
  const dueQuery   = useDueCards()
  const decksQuery = useDecks(50)

  const dueItems: ReadonlyArray<ApiDueCard> = dueQuery.data?.items   ?? []
  const allDecks: ReadonlyArray<ApiDeck>    = decksQuery.data?.items ?? []

  const liveBreakdown = useMemo<QueueBreakdown>(() => {
    if (dueQuery.data === undefined) return { reviewCount: 0, newCount: 0, backlogCount: 0 }
    return countQueueBreakdown(dueItems, initialTodayKey, initialTimeZone)
  }, [dueItems, initialTodayKey, initialTimeZone, dueQuery.data])

  const liveDeckRows = useMemo<DeckRow[]>(() => {
    const counts = new Map<string, number>()
    for (const card of dueItems) {
      if (card.deckId === null) continue
      counts.set(card.deckId, (counts.get(card.deckId) ?? 0) + 1)
    }
    return allDecks.map((d) => ({
      id:       d.id,
      name:     d.name.trim() || 'Untitled deck',
      level:    inferDeckLevel(d),
      dueCount: counts.get(d.id) ?? 0,
    }))
  }, [allDecks, dueItems])

  // ── Effective state ──────────────────────────────────────────────────────
  const isLoading   = previewSnapshot?.isLoading   ?? (dueQuery.isLoading || decksQuery.isLoading)
  const isError     = previewSnapshot?.isError     ?? dueQuery.isError
  const isFirstTime = previewSnapshot?.isFirstTime ?? (!isLoading && !isError && allDecks.length === 0)
  const effectiveOnline = previewSnapshot !== null ? previewSnapshot.isOnline : isOnline

  const breakdown: QueueBreakdown = previewSnapshot?.breakdown ?? liveBreakdown
  const deckRows: ReadonlyArray<DeckRow> = previewSnapshot?.decks ?? liveDeckRows
  const totalDue = breakdown.reviewCount + breakdown.newCount + breakdown.backlogCount

  const isCatchUp = previewSnapshot?.isCatchUp ?? (
    !isLoading && !isError && totalDue > 0 && (
      breakdown.backlogCount >= 20 ||
      (breakdown.backlogCount > 0 && breakdown.backlogCount / Math.max(1, totalDue) >= 0.6)
    )
  )

  const isNoReviews = previewSnapshot?.isCaughtUp ?? (
    !isLoading && !isError && !isFirstTime && deckRows.length > 0 && totalDue === 0
  )

  // ── Filter preview ───────────────────────────────────────────────────────
  const previewCards = useMemo<ApiDueCard[]>(() => {
    if (previewSnapshot !== null) return []
    return filterCardsForSession(dueItems, tuning, {
      todayKey: initialTodayKey,
      timeZone: initialTimeZone,
      decks:    allDecks,
    })
  }, [dueItems, tuning, initialTodayKey, initialTimeZone, allDecks, previewSnapshot])

  const previewBreakdown: QueueBreakdown = useMemo(() => {
    if (previewSnapshot !== null) return previewSnapshot.breakdown
    return countQueueBreakdown(previewCards, initialTodayKey, initialTimeZone)
  }, [previewCards, initialTodayKey, initialTimeZone, previewSnapshot])

  const previewTotal = previewBreakdown.reviewCount + previewBreakdown.newCount + previewBreakdown.backlogCount

  const timeEstimate = useMemo(() => {
    if (previewSnapshot !== null) {
      const secs =
        previewBreakdown.reviewCount  * 15 +
        previewBreakdown.newCount     * 25 +
        previewBreakdown.backlogCount * 15
      return formatSessionEstimate(secs)
    }
    return formatSessionEstimate(estimateSessionSeconds(previewCards))
  }, [previewSnapshot, previewBreakdown, previewCards])

  const includedDeckCount = tuning.includedDeckIds === null
    ? deckRows.length
    : deckRows.filter((d) => tuning.includedDeckIds?.includes(d.id) === true).length

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStart = useCallback((): void => {
    if (previewActive) return
    if (previewCards.length === 0) return
    startSession(previewCards)
    router.push('/review/session')
  }, [previewActive, previewCards, startSession, router])

  const handleRefresh = useCallback((): void => {
    void dueQuery.refetch()
    void decksQuery.refetch()
  }, [dueQuery, decksQuery])

  const showOffline = !effectiveOnline && !isFirstTime && !isError

  // ── Action area (shared between desktop summary and mobile sticky bar) ──
  const actions = (
    <ActionArea
      modified={modified}
      canStart={!isLoading && previewTotal > 0 && !previewActive}
      startLabel={
        isNoReviews
          ? 'Practice ahead'
          : previewTotal === 0
            ? 'Nothing to start'
            : `Start session · ${previewTotal} ${previewTotal === 1 ? 'card' : 'cards'}`
      }
      startHref={isNoReviews ? '/today' : undefined}
      onStart={handleStart}
      onReset={tuningActions.reset}
    />
  )

  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div className="relative z-10 grid flex-1 grid-cols-1 content-center gap-y-8 mx-auto w-full max-w-[1440px] px-6 pt-8 md:px-12 md:pt-10 lg:px-16 lg:pt-12">
      {/* Header */}
      <PageHeader
        kanji="備"
        label="Review setup"
        title="Tune today's session."
        subtitle="Your deck defaults stay the same. These choices only apply today."
      />

      {/* Offline banner */}
      {showOffline && <OfflineBanner />}

      {/* Error */}
      {isError && <ErrorState onRetry={handleRefresh} />}

      {/* First-time */}
      {!isError && isFirstTime && <FirstTimeState />}

      {/* No reviews */}
      {!isError && !isFirstTime && isNoReviews && <NoReviewsState />}

      {/* Normal layout */}
      {!isError && !isFirstTime && !isNoReviews && (
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          {/* Left column: summary (sticky) */}
          <aside className="lg:col-span-5 lg:sticky lg:top-10 lg:self-start">
            <SetupSummary
              tone={isLoading ? 'loading' : isCatchUp ? 'catch-up' : 'default'}
              breakdown={previewBreakdown}
              timeLabel={timeEstimate.label}
              deckCount={includedDeckCount}
              totalDeckCount={deckRows.length}
              modified={modified}
              actions={actions}
            />
          </aside>

          {/* Right column: control SectionCards */}
          <div className="lg:col-span-7">
            <SetupControls
              tuning={tuning}
              onChange={tuningActions.set}
              decks={deckRows}
              totalDue={totalDue}
              disabled={isLoading}
            />
          </div>
        </div>
      )}
      </div>

      {/* Mobile sticky action bar */}
      {!isError && !isFirstTime && (
        <MobileStickyActionBar ariaLabel="Start review session">
          {actions}
        </MobileStickyActionBar>
      )}

      {previewActive && (
        <SetupDevToolbar
          controls={devControls}
          onChange={setDevControls}
          onClose={() => setDevToolsOpen(false)}
        />
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function ActionArea({
  modified,
  canStart,
  startLabel,
  startHref,
  onStart,
  onReset,
}: {
  modified:   boolean
  canStart:   boolean
  startLabel: string
  startHref?: string | undefined
  onStart:    () => void
  onReset:    () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {/* Always-visible microcopy near the action */}
      <p className="text-sm text-faded-sumi">
        {modified ? (
          <>
            <span className="text-sumi-ink">Tuning just for this session.</span>{' '}
            <button
              type="button"
              onClick={onReset}
              className="text-faded-sumi underline decoration-soft-hairline underline-offset-4 hover:text-sumi-ink"
            >
              Reset to defaults
            </button>
            .
          </>
        ) : (
          <>Starts today's session. Your deck defaults stay the same.</>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {startHref !== undefined ? (
          <Link
            href={startHref}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-[2px] bg-inari-vermillion-deep px-6 text-base font-semibold text-warm-paper-raised hover:bg-inari-vermillion focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 sm:flex-none"
          >
            {startLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className={cn(
              'inline-flex h-12 flex-1 items-center justify-center rounded-[2px] px-6 text-base font-semibold sm:flex-none',
              'transition-colors duration-150 ease-out',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              canStart
                ? 'bg-inari-vermillion-deep text-warm-paper-raised hover:bg-inari-vermillion'
                : 'bg-cream-inset text-faded-sumi cursor-not-allowed',
            )}
          >
            {startLabel}
          </button>
        )}
        <QuietLink href="/today">Cancel</QuietLink>
      </div>
    </div>
  )
}

function OfflineBanner(): React.JSX.Element {
  return (
    <div
      role="status"
      className={cn(
        'mb-6 rounded-[2px] border border-soft-hairline bg-cream-inset/60',
        'px-4 py-3 text-sm text-faded-sumi',
      )}
    >
      <p className="text-sumi-ink">Offline, using your cached decks.</p>
      <p className="mt-1">New decks and freshly-due cards won't appear until you reconnect.</p>
    </div>
  )
}

function NoReviewsState(): React.JSX.Element {
  return (
    <SectionCard kanji="済" label="All clear">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Logo size={80} showWordmark={false} />
        <h2
          id="setup-no-reviews-headline"
          className="break-words font-display text-[2.35rem] sm:text-[3rem] lg:text-[3.55rem] leading-[1] text-sumi-ink"
        >
          Nothing scheduled.
          <span className="block text-faded-sumi font-normal">Practice ahead, or add new Japanese.</span>
        </h2>
      </div>

      <p className="mt-5 max-w-[54ch] break-words text-base text-faded-sumi leading-relaxed">
        Your queue is empty for today. Cards return when they are close to fading.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <Link
          href="/today"
          className={cn(
            'inline-flex h-12 items-center justify-center rounded-[2px] bg-inari-vermillion-deep px-6 text-base font-semibold text-warm-paper-raised',
            'transition-colors duration-150 ease-out hover:bg-inari-vermillion',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          )}
        >
          Practice ahead
        </Link>
        <QuietLink href="/add">Add Japanese</QuietLink>
      </div>
    </SectionCard>
  )
}

function FirstTimeState(): React.JSX.Element {
  return (
    <SectionCard kanji="初" label="Welcome" description="No decks yet.">
      <p className="text-sm leading-relaxed text-faded-sumi">
        Subscribe to a premade deck or add your own Japanese to start practicing.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/decks"
          className="inline-flex h-10 items-center justify-center rounded-[2px] bg-inari-vermillion-deep px-4 text-sm font-semibold text-warm-paper-raised hover:bg-inari-vermillion focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          Browse decks
        </Link>
        <QuietLink href="/add">Or add your own</QuietLink>
      </div>
    </SectionCard>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <SectionCard kanji="失" label="Couldn't load" description="Something interrupted the request." stripeTone="error">
      <p className="text-sm leading-relaxed text-faded-sumi">
        Check your connection and try again.
      </p>
      <div className="mt-5">
        <Button variant="primary" size="md" onClick={onRetry}>Retry</Button>
      </div>
    </SectionCard>
  )
}

// ── Pure filter ────────────────────────────────────────────────────────────

function filterCardsForSession(
  items:  ReadonlyArray<ApiDueCard>,
  tuning: SessionTuning,
  ctx:    { todayKey: string; timeZone: string; decks: ReadonlyArray<ApiDeck> },
): ApiDueCard[] {
  const allowedDeckIds = tuning.includedDeckIds === null
    ? new Set<string>(ctx.decks.map((d) => d.id))
    : new Set<string>(tuning.includedDeckIds)

  const FSRS_NEW = 0
  let pool: ApiDueCard[] = items.filter((c) => c.deckId !== null && allowedDeckIds.has(c.deckId))

  if (!tuning.includeNewCards) {
    pool = pool.filter((c) => c.state !== FSRS_NEW)
  }

  if (tuning.overdueFirst) {
    pool = pool.filter((c) => classifyCard(c, ctx.todayKey, ctx.timeZone) === 'backlog')
  }

  if (tuning.reviewOrder === 'shuffle') {
    pool = shuffle(pool)
  } else {
    pool = [...pool].sort((a, b) => {
      const ka = classifyCard(a, ctx.todayKey, ctx.timeZone)
      const kb = classifyCard(b, ctx.todayKey, ctx.timeZone)
      return priorityForKind(ka) - priorityForKind(kb)
    })
  }

  if (tuning.newCardOrder === 'shuffle' && tuning.includeNewCards) {
    const news    = pool.filter((c) => c.state === FSRS_NEW)
    const nonNews = pool.filter((c) => c.state !== FSRS_NEW)
    pool = [...nonNews, ...shuffle(news)]
  }

  if (tuning.sessionSize > 0) {
    pool = pool.slice(0, tuning.sessionSize)
  }

  if (tuning.timeboxMinutes !== null) {
    const budgetSecs = tuning.timeboxMinutes * 60
    const result: ApiDueCard[] = []
    let used = 0
    for (const c of pool) {
      const cost = c.state === FSRS_NEW ? 25 : 15
      if (used + cost > budgetSecs) break
      result.push(c)
      used += cost
    }
    pool = result
  }

  return pool
}

function shuffle<T>(arr: ReadonlyArray<T>): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T]
  }
  return result
}
