'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ApiDueCard, ApiDeck, ApiHeatmapDay } from '@fsrs-japanese/shared-types'

import {
  addDaysToDateKey,
  buildDashboardCalendarContext,
  calendarDateKeyFromApiDate,
  isDashboardDateKey,
  type DashboardCalendarContext,
} from '@/app/(app)/today/_components/today-calendar'
import { safeNonNegativeInteger } from '@/app/(app)/today/_components/today-format'
import { inferDeckLevel } from '@/lib/deck-level'
import { useHeatmapData } from '@/lib/api/analytics'
import { useDecks } from '@/lib/api/decks'
import { useDueCards } from '@/lib/api/reviews'
import { useTomoNote } from '@/lib/api/tomo'
import { useSessionActions } from '@/stores/useReviewSessionStore'

import {
  StagingBriefing,
  type BriefingState,
} from './staging-briefing'
import {
  StagingMetadataRow,
  type YesterdayStat,
} from './staging-metadata-row'
import {
  StagingPinnedDeck,
  type PinnedDeck,
  type TomoNote,
} from './staging-pinned-deck'
import {
  StagingSettings,
  type SessionMode,
} from './staging-settings'
import {
  briefingCopy,
  briefingKickerKanji,
} from './staging-format'
import {
  StagingDevToolbar,
  DEFAULT_STAGING_DEV_CONTROLS,
  type StagingDevControls,
} from './staging-dev-toolbar'
import {
  buildPreviewState,
  previewVariantBlocksBegin,
} from './staging-preview'

const FSRS_NEW = 0
const REVIEW_DEV_TOOLS_TOGGLE_EVENT = 'tomo:review-dev-tools:toggle'
const PREVIEW_ENABLED = process.env.NODE_ENV !== 'production'

// ── Pure helpers ─────────────────────────────────────────────────────────────

interface QueueBreakdown {
  newCount:     number
  reviewCount:  number
  backlogCount: number
}

function classifyCard(
  card:     ApiDueCard,
  todayKey: string,
  timeZone: string,
): 'new' | 'review' | 'backlog' {
  if (card.state === FSRS_NEW) return 'new'
  const dueKey = calendarDateKeyFromApiDate(card.due, timeZone)
  if (isDashboardDateKey(dueKey) && isDashboardDateKey(todayKey) && dueKey < todayKey) return 'backlog'
  return 'review'
}

function countQueueBreakdown(
  items:    ReadonlyArray<ApiDueCard>,
  todayKey: string,
  timeZone: string,
): QueueBreakdown {
  let newCount = 0, reviewCount = 0, backlogCount = 0
  for (const card of items) {
    const kind = classifyCard(card, todayKey, timeZone)
    if (kind === 'new')          newCount++
    else if (kind === 'review')  reviewCount++
    else                          backlogCount++
  }
  return { newCount, reviewCount, backlogCount }
}

function deriveYesterdayStat(
  days:         ReadonlyArray<ApiHeatmapDay>,
  yesterdayKey: string,
): YesterdayStat | null {
  const day = days.find((d) => calendarDateKeyFromApiDate(d.date) === yesterdayKey)
  if (day === undefined) return null
  const reviewed = safeNonNegativeInteger(day.count)
  const retention = Number.isFinite(day.retention) ? day.retention : null
  return { reviewed, retention }
}

/** The lead deck for the v2 staging page is the first deck in the user's
 *  deck order. Until explicit reordering lands on /decks, the API's natural
 *  order (`created_at ASC`) is treated as the order. */
function pickLeadDeck(decks: ReadonlyArray<ApiDeck>): ApiDeck | null {
  return decks[0] ?? null
}

function buildPinnedDeck(
  leadDeck: ApiDeck,
  dueItems: ReadonlyArray<ApiDueCard>,
  todayKey: string,
  timeZone: string,
): PinnedDeck {
  const cardsForDeck = dueItems.filter((card) => card.deckId === leadDeck.id)
  const breakdown = countQueueBreakdown(cardsForDeck, todayKey, timeZone)
  return {
    id:           leadDeck.id,
    title:        leadDeck.name.trim() || 'Untitled deck',
    level:        inferDeckLevel(leadDeck),
    dueCount:     cardsForDeck.length,
    newCount:     breakdown.newCount,
    reviewCount:  breakdown.reviewCount,
    backlogCount: breakdown.backlogCount,
    totalCards:   safeNonNegativeInteger(leadDeck.cardCount),
  }
}

function filterCardsForSession(
  items: ReadonlyArray<ApiDueCard>,
  opts:  { mode: SessionMode; todayKey: string; timeZone: string },
): ApiDueCard[] {
  const filtered: ApiDueCard[] = []
  for (const card of items) {
    if (opts.mode === 'new'    && card.state !== FSRS_NEW) continue
    if (opts.mode === 'review' && card.state === FSRS_NEW) continue
    filtered.push(card)
  }
  // Backlog before review before new, so the session begins on the most
  // urgent cards. This matches the dashboard's queue ordering.
  filtered.sort((a, b) => {
    const ka = classifyCard(a, opts.todayKey, opts.timeZone)
    const kb = classifyCard(b, opts.todayKey, opts.timeZone)
    return priorityForKind(ka) - priorityForKind(kb)
  })
  return filtered
}

function priorityForKind(kind: 'backlog' | 'review' | 'new'): number {
  if (kind === 'backlog') return 0
  if (kind === 'review')  return 1
  return 2
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ReviewStagingClientProps {
  initialTodayKey: string
  initialTimeZone: string
}

export function ReviewStagingClient({
  initialTodayKey,
  initialTimeZone,
}: ReviewStagingClientProps): React.JSX.Element {
  const router = useRouter()
  const { startSession } = useSessionActions()

  const [calendar, setCalendar] = useState<DashboardCalendarContext>(() => ({
    dateLabel:      '',
    dateTime:       initialTodayKey,
    greetingPrefix: '',
    todayKey:       initialTodayKey,
    yesterdayKey:   addDaysToDateKey(initialTodayKey, -1),
    timeZone:       initialTimeZone,
  }))

  useEffect(() => {
    function tick(): void {
      setCalendar(buildDashboardCalendarContext(new Date(), initialTimeZone))
    }
    const id = window.setInterval(tick, 60 * 1000)
    return () => window.clearInterval(id)
  }, [initialTimeZone])

  // ── Dev preview wiring ──────────────────────────────────────────────────
  const [devControls, setDevControls]     = useState<StagingDevControls>(DEFAULT_STAGING_DEV_CONTROLS)
  const [devToolsOpen, setDevToolsOpen]   = useState(false)

  useEffect(() => {
    if (!PREVIEW_ENABLED) return
    function handleToggle(): void { setDevToolsOpen((open) => !open) }
    window.addEventListener(REVIEW_DEV_TOOLS_TOGGLE_EVENT, handleToggle)
    return () => window.removeEventListener(REVIEW_DEV_TOOLS_TOGGLE_EVENT, handleToggle)
  }, [])

  useEffect(() => {
    if (!devToolsOpen) return
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setDevToolsOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [devToolsOpen])

  const previewActive = PREVIEW_ENABLED && devToolsOpen

  // ── Queries ─────────────────────────────────────────────────────────────
  const dueQuery     = useDueCards()
  const decksQuery   = useDecks()
  const heatmapQuery = useHeatmapData()

  const dueItems = dueQuery.data?.items ?? []
  const allDecks = decksQuery.data?.items ?? []
  const heatmap  = heatmapQuery.data?.items ?? []

  // ── Live derivations ────────────────────────────────────────────────────
  const liveBreakdown = useMemo<QueueBreakdown | null>(() => {
    if (dueQuery.data === undefined) return null
    return countQueueBreakdown(dueItems, calendar.todayKey, calendar.timeZone)
  }, [calendar.timeZone, calendar.todayKey, dueItems, dueQuery.data])

  const liveLeadDeck = useMemo(() => pickLeadDeck(allDecks), [allDecks])

  const livePinnedDeck = useMemo<PinnedDeck | null>(() => {
    if (liveLeadDeck === null) return null
    return buildPinnedDeck(liveLeadDeck, dueItems, calendar.todayKey, calendar.timeZone)
  }, [calendar.timeZone, calendar.todayKey, dueItems, liveLeadDeck])

  const liveYesterday = useMemo<YesterdayStat | null>(() => {
    if (heatmapQuery.data === undefined) return null
    return deriveYesterdayStat(heatmap, calendar.yesterdayKey)
  }, [calendar.yesterdayKey, heatmap, heatmapQuery.data])

  // Tomo's note is wired through the daily-note API (Backend Completion
  // Plan Stage 6). The server caches per learner-local day and substitutes
  // a curated idiom whenever the AI path is unavailable, so this hook
  // typically resolves to a populated value; null surfaces only when the
  // user has no profile row (rare) or before the first paint.
  const tomoNoteQuery = useTomoNote()
  const liveTomoNote: TomoNote | null = tomoNoteQuery.data !== undefined && tomoNoteQuery.data !== null
    ? { body: tomoNoteQuery.data.body, date: tomoNoteQuery.data.dateKey }
    : null
  // Leech-count API doesn't exist yet (brief open question #4). Live value
  // stays null; preview can synthesize it.
  const liveLeechCount: number | null   = null

  // ── State machine (live) ────────────────────────────────────────────────
  const liveIsLoading  = dueQuery.isLoading || decksQuery.isLoading
  const liveIsError    = dueQuery.isError
  const liveHasDecks   = allDecks.length > 0
  const liveTotalDue   = dueItems.length
  const liveIsFirstTime = !liveIsLoading && !liveIsError && !liveHasDecks
  const liveIsCaughtUp  = !liveIsLoading && !liveIsError && liveHasDecks && liveTotalDue === 0
  const liveIsBacklog   = !liveIsLoading && !liveIsError && liveTotalDue > 0 && liveBreakdown !== null && (
    liveBreakdown.backlogCount >= 20 ||
    (liveBreakdown.backlogCount > 0 && liveBreakdown.backlogCount / Math.max(1, liveTotalDue) >= 0.6)
  )

  // ── Preview state (dev only) ────────────────────────────────────────────
  const previewState = useMemo(
    () => previewActive ? buildPreviewState(devControls) : null,
    [previewActive, devControls],
  )

  // ── Effective view ──────────────────────────────────────────────────────
  const isLoading   = previewState !== null ? previewState.isLoading   : liveIsLoading
  const isError     = previewState !== null ? previewState.isError     : liveIsError
  const totalDue    = previewState !== null ? previewState.totalDue    : liveTotalDue
  const breakdown   = previewState !== null ? previewState.breakdown   : liveBreakdown
  const pinnedDeck  = previewState !== null ? previewState.pinnedDeck  : livePinnedDeck
  const tomoNote    = previewState !== null ? previewState.tomoNote    : liveTomoNote
  const yesterday   = previewState !== null ? previewState.yesterday   : liveYesterday
  const leechCount  = previewState !== null ? previewState.leechCount  : liveLeechCount
  const isFirstTime = previewState !== null ? previewState.isFirstTime : liveIsFirstTime
  const isCaughtUp  = previewState !== null ? previewState.isCaughtUp  : liveIsCaughtUp
  const isBacklog   = previewState !== null ? previewState.isBacklog   : liveIsBacklog
  const isPaused    = previewState !== null ? previewState.isPaused    : false
  const skippedDays = previewState !== null ? previewState.skippedDays : 0

  const briefingState: BriefingState = isLoading
    ? 'loading'
    : isError
      ? 'error'
      : isFirstTime
        ? 'first-time'
        : isCaughtUp
          ? 'all-clear'
          : isBacklog
            ? 'backlog'
            : isPaused
              ? 'paused'
              : 'default'

  // ── Session settings ────────────────────────────────────────────────────
  const [mode, setMode] = useState<SessionMode>('mixed')

  // ── Briefing copy ───────────────────────────────────────────────────────
  const { body: bodyCopy } = useMemo(() => briefingCopy({
    total:        totalDue,
    newCount:     breakdown?.newCount ?? 0,
    reviewCount:  breakdown?.reviewCount ?? 0,
    backlogCount: breakdown?.backlogCount ?? 0,
    deckCount:    pinnedDeck !== null ? 1 : 0,  // v2 surfaces one lead deck only
    skippedDays,
  }), [breakdown?.backlogCount, breakdown?.newCount, breakdown?.reviewCount, pinnedDeck, skippedDays, totalDue])

  const kicker = briefingKickerKanji({
    isFirstTime,
    isCaughtUp,
    isPaused,
    isBacklog,
  })

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleBegin(): void {
    if (totalDue === 0) return
    if (previewActive || previewVariantBlocksBegin(devControls.variant)) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[review staging] Begin suppressed: preview mode active.')
      }
      return
    }
    const cards = filterCardsForSession(dueItems, {
      mode,
      todayKey: calendar.todayKey,
      timeZone: calendar.timeZone,
    })
    if (cards.length === 0) return
    startSession(cards)
    router.push('/review/session')
  }

  function handleStudyAhead(): void {
    router.push('/review/setup?mode=ahead')
  }

  function handleRefresh(): void {
    void dueQuery.refetch()
    void decksQuery.refetch()
    void heatmapQuery.refetch()
  }

  const briefingMotionKey = [
    briefingState,
    totalDue,
    breakdown?.newCount ?? 0,
    breakdown?.reviewCount ?? 0,
    breakdown?.backlogCount ?? 0,
    mode,
  ].join('-')

  const deckMotionKey = [
    briefingState,
    pinnedDeck?.id ?? 'none',
    pinnedDeck?.dueCount ?? 0,
  ].join('-')

  // ── Render ──────────────────────────────────────────────────────────────
  const metadataRow = !isLoading && !isError ? (
    <StagingMetadataRow yesterday={yesterday} leechCount={leechCount} />
  ) : undefined

  return (
    <div className="mx-auto max-w-[1360px] px-4 pt-6 pb-12 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
      <div className="grid gap-y-6 lg:gap-y-8">
        {/* Row 1 — Briefing (8) + Settings (4) */}
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-8">
            <div key={briefingMotionKey}>
              <StagingBriefing
                state={briefingState}
                totalDue={totalDue}
                newCount={breakdown?.newCount ?? 0}
                reviewCount={breakdown?.reviewCount ?? 0}
                backlogCount={breakdown?.backlogCount ?? 0}
                bodyCopy={bodyCopy}
                kickerKanji={kicker.kanji}
                kickerLabel={kicker.label}
                metadataRow={metadataRow}
                onBegin={handleBegin}
                onSecondary={isError ? handleRefresh : handleStudyAhead}
                secondaryLabel={
                  isError ? 'Refresh route' :
                  isFirstTime ? 'Browse decks' :
                  isCaughtUp ? 'Study ahead' : undefined
                }
                secondaryHref={isFirstTime ? '/decks' : undefined}
                beginDisabled={totalDue === 0}
              />
            </div>
          </div>

          <div className="lg:col-span-4">
            <StagingSettings
              mode={mode}
              onModeChange={setMode}
              disabled={isCaughtUp || isFirstTime || isLoading || isError}
            />
          </div>
        </div>

        {/* Row 2 — Pinned deck (full width) */}
        <div key={deckMotionKey}>
          <StagingPinnedDeck
            state={isLoading ? 'loading' : isError ? 'error' : 'default'}
            deck={pinnedDeck}
            note={tomoNote}
            isFirstTime={isFirstTime}
          />
        </div>

        {/* Footer note */}
        <p className="mt-2 border-t border-soft-hairline/70 pt-4 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi/85">
          FSRS scheduling. Cards return when they are close to fading.
        </p>
      </div>

      {previewActive && (
        <StagingDevToolbar
          controls={devControls}
          onChange={setDevControls}
          onClose={() => setDevToolsOpen(false)}
        />
      )}
    </div>
  )
}
