'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import type { ApiDeck, ApiDueCard, ApiForecastDay, ApiHeatmapDay } from '@fsrs-japanese/shared-types'

import { useHeatmapData } from '@/lib/api/analytics'
import { useDecks } from '@/lib/api/decks'
import { useDueCards, useReviewForecast } from '@/lib/api/reviews'
import { inferDeckLevel } from '@/lib/deck-level'

import { ActiveDecks, type ActiveDeck } from './active-decks'
import {
  clampRatio,
  safeNonNegativeInteger,
  safePercentagePoint,
} from './dashboard-format'
import {
  addDaysToDateKey,
  buildDashboardCalendarContext,
  calendarDateKeyFromApiDate,
  dateNumberFromDateKey,
  dayLabelForDateKey,
  isDashboardDateKey,
  normalizeDashboardTimeZone,
  type DashboardCalendarContext,
} from './dashboard-calendar'
import {
  DashboardHero,
  type DashboardHeroVariant,
  type DueQueue,
  type HeroDeckTag,
  type HeroDeckPreview,
} from './dashboard-hero'
import { DashboardHeroDevToolbar, type HeroDevControls } from './dashboard-hero-dev-toolbar'
import {
  DashboardModulesDevToolbar,
  type ModuleDevControls,
  type ModulePreviewState,
} from './dashboard-modules-dev-toolbar'
import { DashboardModuleReveal, DashboardStatePresence } from './dashboard-motion'
import { ForecastChart } from './forecast-chart'
import { Leeches, type Leech } from './leeches'
import { PracticeSignal, type PracticeInsight } from './practice-signal'
import { RecentActivity, type ActivityRow } from './recent-activity'
import type { ModuleState } from './section-primitives'

const FORECAST_HORIZON_DAYS = 14
const HERO_PREVIEW_ENABLED = process.env.NODE_ENV !== 'production'
const DASHBOARD_DEV_TOOLS_TOGGLE_EVENT = 'tomo:dashboard-dev-tools:toggle'

const FSRS_NEW = 0

interface QueueBreakdown {
  newCnt:  number
  review:  number
  backlog: number
}

interface DashboardForecastDay {
  label:        string
  dateNum:      number
  count:        number
  isToday:      boolean
  newCount:     number
  reviewCount:  number
  backlogCount: number
}

interface DashboardClientProps {
  dateLabel:      string
  dateTime:       string
  greetingName:   string | null
  greetingPrefix: string
  timeZone:       string
}

interface PracticeGreetingCopy {
  message: string
}

function dashboardCalendarContextMatches(
  current: DashboardCalendarContext,
  next: DashboardCalendarContext,
): boolean {
  return current.dateLabel === next.dateLabel
    && current.dateTime === next.dateTime
    && current.greetingPrefix === next.greetingPrefix
    && current.todayKey === next.todayKey
    && current.yesterdayKey === next.yesterdayKey
    && current.timeZone === next.timeZone
}

const DEFAULT_HERO_DEV_CONTROLS: HeroDevControls = {
  variant:  'due',
  queue:    'typical',
  decks:    'three',
  routeMix: 'balanced',
  flag:     'none',
}

const DEFAULT_MODULE_DEV_CONTROLS: ModuleDevControls = {
  tomo:     'default',
  forecast: 'default',
  decks:    'default',
  leeches:  'default',
  recent:   'default',
}

/**
 * Build a complete N-day forecast series starting from today. Maps API days
 * by plain YYYY-MM-DD key, then walks forward N learner-calendar days from
 * today filling counts from the map. Keeping API date strings as calendar keys
 * avoids the `new Date('YYYY-MM-DD')` UTC-midnight shift that moves forecast
 * data one day earlier for learners west of UTC.
 *
 * The API owns the split between overdue backlog, scheduled reviews, and
 * actual new-card inventory. The dashboard only pads missing dates to keep
 * the chart structurally stable. Today's overdue bucket is also patched from
 * the live due queue so backlog remains visible while forecast data catches up.
 */
function buildPaddedForecast(
  apiDays: ReadonlyArray<ApiForecastDay>,
  horizonDays: number,
  todayKey: string,
  todayBreakdown: QueueBreakdown | null,
): DashboardForecastDay[] {
  const dayByKey = new Map<string, ApiForecastDay>()
  for (const d of apiDays) {
    dayByKey.set(calendarDateKeyFromApiDate(d.date), d)
  }

  const out: DashboardForecastDay[] = []
  for (let i = 0; i < horizonDays; i++) {
    const key = addDaysToDateKey(todayKey, i)
    const day = dayByKey.get(key)
    const apiBacklogCount = safeNonNegativeInteger(day?.backlogCount)
    const backlogCount = i === 0 && todayBreakdown !== null
      ? Math.max(apiBacklogCount, todayBreakdown.backlog)
      : apiBacklogCount
    const newCount     = safeNonNegativeInteger(day?.newCount)
    const reviewCount  = safeNonNegativeInteger(day?.reviewCount)
    const count        = backlogCount + reviewCount + newCount

    out.push({
      label:        dayLabelForDateKey(key),
      dateNum:      dateNumberFromDateKey(key),
      count,
      isToday:      i === 0,
      newCount,
      reviewCount,
      backlogCount,
    })
  }
  return out
}

function buildHeroQueueFromDueCards(
  items:    ApiDueCard[],
  todayKey: string,
  timeZone: string,
  deckById: ReadonlyMap<string, ApiDeck>,
): DueQueue {
  const breakdown = countQueueBreakdown(items, todayKey, timeZone)
  const grouped     = groupDueCards(items)
  const deckEntries = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)
  const decks       = deckEntries.slice(0, 3).map(([, cards], index) => toHeroDeck(cards, index, deckById))

  return {
    total:         breakdown.newCnt + breakdown.review + breakdown.backlog,
    newCnt:        breakdown.newCnt,
    review:        breakdown.review,
    backlog:       breakdown.backlog,
    decks,
    overflowDecks: Math.max(0, deckEntries.length - decks.length),
  }
}

function toDashboardDeck(deck: ApiDeck): ActiveDeck {
  return {
    id:         deck.id,
    title:      deck.name.trim() || 'Untitled deck',
    level:      inferDeckLevel(deck),
    totalCards: safeNonNegativeInteger(deck.cardCount),
  }
}

function buildRecentActivityRows(days: ApiHeatmapDay[], todayKey: string): ActivityRow[] {
  const dayByKey = new Map<string, ApiHeatmapDay>()
  for (const day of days) {
    dayByKey.set(calendarDateKeyFromApiDate(day.date), day)
  }

  const rows: ActivityRow[] = []
  for (let offset = 0; offset < 7; offset++) {
    const key = addDaysToDateKey(todayKey, -offset)
    const day = dayByKey.get(key)
    const reviewed = safeNonNegativeInteger(day?.count)
    rows.push({
      date:      offset === 0 ? 'Today' : dayLabelForDateKey(key),
      reviewed,
      retention: reviewed > 0 && day !== undefined && Number.isFinite(day.retention)
        ? clampRatio(day.retention / 100)
        : null,
    })
  }

  return rows.some((row) => row.reviewed !== 0) ? rows : []
}

function countQueueBreakdown(
  items:    ApiDueCard[],
  todayKey: string,
  timeZone: string,
): QueueBreakdown {
  let backlog = 0
  let newCnt  = 0
  let review  = 0

  for (const card of items) {
    if (isOverdue(card, todayKey, timeZone)) {
      backlog += 1
    } else if (card.state === FSRS_NEW) {
      newCnt += 1
    } else {
      review += 1
    }
  }

  return { newCnt, review, backlog }
}

function groupDueCards(items: ApiDueCard[]): Map<string, ApiDueCard[]> {
  const out = new Map<string, ApiDueCard[]>()
  for (const card of items) {
    const key = card.deckId ?? `${card.jlptLevel ?? 'mixed'}-${card.layoutType}`
    const bucket = out.get(key)
    if (bucket === undefined) {
      out.set(key, [card])
    } else {
      bucket.push(card)
    }
  }
  return out
}

function toHeroDeck(
  cards:    ApiDueCard[],
  index:    number,
  deckById: ReadonlyMap<string, ApiDeck>,
): HeroDeckPreview {
  const layout = dominant(cards.map((card) => card.layoutType))
  const newCount = cards.filter((card) => card.state === FSRS_NEW).length
  const deckId = cards[0]?.deckId
  const sourceDeck = deckId != null ? deckById.get(deckId) : undefined
  const title = sourceDeck?.name ?? (deckId != null ? 'Active deck' : `${formatLayoutType(layout)} queue`)
  const level = dominant(
    cards
      .map((card) => card.jlptLevel)
      .filter((cardLevel): cardLevel is NonNullable<ApiDueCard['jlptLevel']> => cardLevel !== null),
  ) ?? (sourceDeck !== undefined ? inferDeckLevel(sourceDeck) : null)
  const tag: HeroDeckTag = level !== null
    ? { kind: 'level', level }
    : { kind: 'none' }

  return {
    id:          deckId ?? `queue-${index}`,
    title,
    subtitle:    sourceDeck !== undefined
      ? 'Active deck queue'
      : (deckId != null ? 'Deck metadata unavailable' : 'Mixed queue'),
    dueCount:    cards.length,
    newCount,
    reviewCount: cards.length - newCount,
    tag,
  }
}

function isOverdue(card: ApiDueCard, todayKey: string, timeZone: string): boolean {
  const dueKey = calendarDateKeyFromApiDate(card.due, timeZone)
  return isDashboardDateKey(dueKey) && isDashboardDateKey(todayKey) && dueKey < todayKey
}

function dominant<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function formatLayoutType(layout: ApiDueCard['layoutType'] | null): string {
  switch (layout) {
    case 'grammar':    return 'Grammar'
    case 'sentence':   return 'Sentence'
    case 'vocabulary': return 'Vocabulary'
    default:           return 'Mixed'
  }
}

function buildPreviewHeroVariant(controls: HeroDevControls): DashboardHeroVariant {
  switch (controls.variant) {
    case 'due':
      return { kind: 'due', queue: buildPreviewQueue(controls) }
    case 'caught-up':
      return { kind: 'caught-up' }
    case 'first-time':
      return { kind: 'first-time' }
    case 'loading':
      return { kind: 'loading' }
    case 'error':
      return { kind: 'error' }
  }
}

function buildPreviewQueue(controls: HeroDevControls): DueQueue {
  const breakdown = previewQueueBreakdown(controls)
  const total = breakdown.newCnt + breakdown.review + breakdown.backlog
  const { decks, overflowDecks } = previewDecks(controls.decks, total)

  return {
    total,
    newCnt:        breakdown.newCnt,
    review:        breakdown.review,
    backlog:       breakdown.backlog,
    statusNote:    controls.flag === 'stale-data' ? 'Showing the last saved route' : undefined,
    decks,
    overflowDecks,
  }
}

function previewQueueBreakdown(controls: HeroDevControls): QueueBreakdown {
  const queueShape = queuePresetShape(controls.queue)
  const newCnt = previewNewCount(queueShape, controls.routeMix)
  const backlog = queueShape.backlog
  const review = Math.max(0, queueShape.total - newCnt - backlog)
  return { newCnt, review, backlog }
}

function queuePresetShape(queue: HeroDevControls['queue']): { total: number; newCnt: number; backlog: number } {
  switch (queue) {
    case 'one':           return { total: 1,  newCnt: 0,  backlog: 0  }
    case 'no-backlog':    return { total: 12, newCnt: 3,  backlog: 0  }
    case 'typical':       return { total: 12, newCnt: 3,  backlog: 2  }
    case 'backlog-heavy': return { total: 34, newCnt: 2,  backlog: 19 }
    case 'large':         return { total: 84, newCnt: 18, backlog: 11 }
  }
}

function previewNewCount(
  shape:    { total: number; newCnt: number; backlog: number },
  routeMix: HeroDevControls['routeMix'],
): number {
  const todayCapacity = Math.max(0, shape.total - shape.backlog)
  if (todayCapacity <= 0) return 0

  const ratio =
    routeMix === 'new-heavy'    ? 0.55 :
    routeMix === 'review-heavy' ? 0.10 :
                                  null

  if (ratio === null) return Math.min(shape.newCnt, todayCapacity)
  return Math.min(todayCapacity, Math.max(todayCapacity === 1 ? 0 : 1, Math.round(todayCapacity * ratio)))
}

function previewDecks(
  preset: HeroDevControls['decks'],
  total:  number,
): { decks: HeroDeckPreview[]; overflowDecks: number } {
  const samples: [HeroDeckPreview, HeroDeckPreview, HeroDeckPreview] = [
    {
      id:          'preview-n4-verbs',
      title:       'N4 verbs',
      subtitle:    'Conjugation and recall',
      dueCount:    Math.max(1, Math.round(total * 0.45)),
      newCount:    2,
      reviewCount: Math.max(0, Math.round(total * 0.45) - 2),
      tag:          { kind: 'level', level: 'N4' },
    },
    {
      id:          'preview-kanji',
      title:       'Joyo kanji',
      subtitle:    'Recognition practice',
      dueCount:    Math.max(1, Math.round(total * 0.32)),
      newCount:    1,
      reviewCount: Math.max(0, Math.round(total * 0.32) - 1),
      tag:          { kind: 'level', level: 'N3' },
    },
    {
      id:          'preview-grammar',
      title:       'Grammar patterns',
      subtitle:    'Short examples',
      dueCount:    Math.max(1, total - Math.round(total * 0.77)),
      newCount:    0,
      reviewCount: Math.max(1, total - Math.round(total * 0.77)),
      tag:          { kind: 'level', level: 'beyond_jlpt' },
    },
  ]
  const primary = samples[0]
  const primaryNewCount = primary.newCount ?? 0

  switch (preset) {
    case 'none':
      return { decks: [], overflowDecks: 0 }
    case 'one':
      return {
        decks: [
          {
            ...primary,
            dueCount:    total,
            reviewCount: Math.max(0, total - primaryNewCount),
          },
        ],
        overflowDecks: 0,
      }
    case 'two':
      return { decks: samples.slice(0, 2), overflowDecks: 0 }
    case 'three':
      return { decks: samples, overflowDecks: 0 }
    case 'more':
      return { decks: samples, overflowDecks: 4 }
  }
}

function previewStateToModuleState(state: ModulePreviewState): ModuleState {
  if (state === 'loading') return 'loading'
  if (state === 'error') return 'error'
  if (state === 'unavailable') return 'unavailable'
  return 'default'
}

function isPreviewEmpty(state: ModulePreviewState): boolean {
  return state === 'empty'
}

function buildPreviewForecastDays(
  todayBreakdown: QueueBreakdown,
  todayKey: string,
): ReturnType<typeof buildPaddedForecast> {
  const counts = [
    { backlogCount: todayBreakdown.backlog, reviewCount: todayBreakdown.review, newCount: todayBreakdown.newCnt },
    { backlogCount: 0, reviewCount: 8,  newCount: 0 },
    { backlogCount: 0, reviewCount: 18, newCount: 2 },
    { backlogCount: 0, reviewCount: 5,  newCount: 0 },
    { backlogCount: 0, reviewCount: 22, newCount: 1 },
    { backlogCount: 0, reviewCount: 14, newCount: 0 },
    { backlogCount: 0, reviewCount: 0,  newCount: 0 },
    { backlogCount: 0, reviewCount: 9,  newCount: 3 },
    { backlogCount: 0, reviewCount: 6,  newCount: 0 },
    { backlogCount: 0, reviewCount: 13, newCount: 1 },
    { backlogCount: 0, reviewCount: 4,  newCount: 0 },
    { backlogCount: 0, reviewCount: 17, newCount: 2 },
    { backlogCount: 0, reviewCount: 7,  newCount: 0 },
    { backlogCount: 0, reviewCount: 10, newCount: 0 },
  ]
  const apiDays = counts.map((day, index) => ({
    date:         addDaysToDateKey(todayKey, index),
    count:        day.backlogCount + day.reviewCount + day.newCount,
    backlogCount: day.backlogCount,
    reviewCount:  day.reviewCount,
    newCount:     day.newCount,
  }))
  return buildPaddedForecast(apiDays, FORECAST_HORIZON_DAYS, todayKey, todayBreakdown)
}

function compareHeatmapDatesDesc(a: ApiHeatmapDay, b: ApiHeatmapDay): number {
  return b.date.localeCompare(a.date)
}

function findPreviousReviewDay(
  days: ReadonlyArray<ApiHeatmapDay>,
  beforeDate: string,
): ApiHeatmapDay | null {
  return [...days]
    .filter((day) => (
      day.date < beforeDate &&
      safeNonNegativeInteger(day.count) > 0 &&
      Number.isFinite(day.retention)
    ))
    .sort(compareHeatmapDatesDesc)[0] ?? null
}

function skippedDaysBeforeToday(days: ReadonlyArray<ApiHeatmapDay>, todayKey: string): number {
  const reviewedDates = new Set(
    days
      .filter((day) => safeNonNegativeInteger(day.count) > 0)
      .map((day) => day.date),
  )
  let skipped = 0

  for (let offset = 1; offset <= 30; offset += 1) {
    if (reviewedDates.has(addDaysToDateKey(todayKey, -offset))) break
    skipped += 1
  }

  return skipped
}

function buildPracticeGreetingCopy({
  days,
  isLoading,
  todayKey,
  yesterdayKey,
}: {
  days:         ReadonlyArray<ApiHeatmapDay>
  isLoading:    boolean
  todayKey:     string
  yesterdayKey: string
}): PracticeGreetingCopy {
  if (isLoading) {
    return {
      message: 'Your practice space is settling into place.',
    }
  }

  const yesterday = days.find((day) => (
    day.date === yesterdayKey &&
    safeNonNegativeInteger(day.count) > 0
  ))

  if (days.length === 0) {
    return {
      message: 'Your practice space is ready.',
    }
  }

  if (yesterday === undefined) {
    const skipped = skippedDaysBeforeToday(days, todayKey)
    if (skipped >= 2) {
      return {
        message: `You skipped ${skipped} days. Start with today.`,
      }
    }

    return {
      message: 'You skipped yesterday. No worries, right back at it.',
    }
  }

  if (!Number.isFinite(yesterday.retention)) {
    return {
      message: 'You reviewed yesterday. Keep the rhythm.',
    }
  }

  const previous = findPreviousReviewDay(days, yesterdayKey)
  if (previous === null) {
    return {
      message: 'You reviewed yesterday. Keep the rhythm.',
    }
  }

  const delta = Math.round(safePercentagePoint(yesterday.retention) - safePercentagePoint(previous.retention))
  if (delta >= 5) {
    return {
      message: `Yesterday was ${delta} points higher. Keep the rhythm.`,
    }
  }

  if (delta <= -5) {
    return {
      message: `Yesterday was ${Math.abs(delta)} points lower. Start small today.`,
    }
  }

  return {
    message: 'Yesterday held steady. Begin when you are ready.',
  }
}

const PREVIEW_DECKS: ActiveDeck[] = [
  {
    id:              'preview-n4-verbs',
    title:           'N4 verbs',
    level:           'N4',
    dueCount:        5,
    totalCards:      320,
    newCount:        2,
    reviewCount:     3,
    masteryPercent:  42,
    lastReviewedRel: 'yesterday',
  },
  {
    id:              'preview-joyo-kanji',
    title:           'Joyo kanji',
    level:           'N3',
    dueCount:        4,
    totalCards:      640,
    newCount:        1,
    reviewCount:     3,
    masteryPercent:  58,
    lastReviewedRel: '2 days ago',
  },
  {
    id:              'preview-grammar',
    title:           'Grammar patterns',
    level:           'beyond_jlpt',
    dueCount:        3,
    totalCards:      180,
    newCount:        0,
    reviewCount:     3,
    masteryPercent:  27,
    lastReviewedRel: 'Friday',
  },
]

const PREVIEW_LEECHES: Leech[] = [
  { cardId: 'preview-leech-1', word: '払う', reading: 'はらう', errors: 9 },
  { cardId: 'preview-leech-2', word: '必要', reading: 'ひつよう', errors: 8 },
  { cardId: 'preview-leech-3', word: '続ける', reading: 'つづける', errors: 7 },
]

const PREVIEW_RECENT: ActivityRow[] = [
  { date: 'Today',     reviewed: null, retention: null },
  { date: 'Sunday',    reviewed: 18,   retention: 0.89 },
  { date: 'Saturday',  reviewed: 0,    retention: null },
  { date: 'Friday',    reviewed: 24,   retention: 0.83 },
  { date: 'Thursday',  reviewed: 31,   retention: 0.91 },
  { date: 'Wednesday', reviewed: 17,   retention: 0.86 },
  { date: 'Tuesday',   reviewed: 22,   retention: 0.81 },
]

const PREVIEW_PRACTICE_SIGNAL: PracticeInsight = {
  date: 'May 11',
  body: (
    <>
      You&apos;re steady on recognition cards. Give a little extra care to{' '}
      <span lang="ja">払う</span> today, it has been slipping when it appears in short sentences.
    </>
  ),
}

function DashboardMasthead({
  dateLabel,
  dateTime,
  greetingName,
  greetingPrefix,
  practiceGreeting,
}: {
  dateLabel:      string
  dateTime:       string
  greetingName:   string | null
  greetingPrefix: string
  practiceGreeting: PracticeGreetingCopy
}): React.JSX.Element {
  const greetingLead = greetingName !== null
    ? `${greetingPrefix}, ${greetingName}.`
    : `${greetingPrefix}.`
  const greeting = `${greetingLead} ${practiceGreeting.message}`
  const mastheadDate = formatLearnerMastheadDate(dateTime, dateLabel)

  return (
    <section
      aria-labelledby="dashboard-heading"
      className={[
        'relative isolate mb-6 overflow-visible bg-cool-paper-base',
        'lg:mb-8',
      ].join(' ')}
    >
      {/*
        Image brief: /assets/dashboard/hero-garden-background.png is the current
        warm, low-contrast masthead image made specifically for Tomo.

        Scene: a quiet morning Japanese study desk viewed slightly from above.
        Include a small stack of paper flashcards, a brush pen or fountain pen,
        a ceramic coffee cup or tea cup, and a soft hint of Japanese writing
        practice on paper. Keep the scene adult, calm, and tactile. It should
        not feel cute, anime, tourist-shop Japanese, or corporate stock.

        Desktop composition: the important objects should live in the right
        40 percent of the frame, with the left side intentionally open and
        low-detail so the greeting has clean contrast. The image should fade
        naturally into warm paper toward the left and bottom.

        Tablet composition: keep the card stack and cup visible in the upper
        right quadrant, with enough empty paper texture behind the text.

        Mobile composition: crop to subtle paper and ink texture with only a
        partial card edge or cup rim near the top/right. Avoid busy details
        behind text.

        Color and material: warm paper, sumi ink, muted Inari vermillion
        accents, soft daylight, shallow contrast, no pure white, and no
        saturated tech colors.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-12 top-0 overflow-hidden sm:-bottom-14 lg:-bottom-16"
      >
        <Image
          src="/assets/dashboard/hero-garden-background.png"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="(min-width: 1024px) calc(100vw - 18rem), 100vw"
          className="object-cover opacity-[0.72] contrast-[1.18] brightness-[0.96]"
          style={{
            objectPosition:  'center 78%',
            WebkitMaskImage: [
              'linear-gradient(90deg, transparent 0%, rgb(0 0 0 / 0.28) 18%, black 42%, black 100%)',
              'linear-gradient(180deg, black 0%, black 76%, transparent 100%)',
            ].join(', '),
            maskImage: [
              'linear-gradient(90deg, transparent 0%, rgb(0 0 0 / 0.28) 18%, black 42%, black 100%)',
              'linear-gradient(180deg, black 0%, black 76%, transparent 100%)',
            ].join(', '),
            WebkitMaskComposite: 'source-in',
            maskComposite:       'intersect',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: [
              'linear-gradient(180deg, transparent 0%, transparent 68%, var(--color-cool-paper-base) 100%)',
              'linear-gradient(90deg, color-mix(in srgb, var(--color-warm-paper-raised) 94%, transparent) 0%, color-mix(in srgb, var(--color-warm-paper-raised) 74%, transparent) 30%, color-mix(in srgb, var(--color-warm-paper-raised) 18%, transparent) 72%, transparent 100%)',
              'linear-gradient(0deg, color-mix(in srgb, var(--color-inari-vermillion) 2.5%, transparent), color-mix(in srgb, var(--color-inari-vermillion) 2.5%, transparent))',
            ].join(', '),
          }}
        />
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-inari-vermillion/60" />
      <span
        lang="ja"
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 select-none font-display text-[6.5rem] leading-none text-inari-vermillion/[0.08] sm:block lg:right-[8vw]"
      >
        今日
      </span>

      <div className="relative mx-auto grid max-w-[1360px] gap-4 px-6 py-5 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-10 lg:py-6">
        <div className="max-w-[48rem]">
          <div className="flex items-center gap-3">
            <span
              lang="ja"
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-inari-vermillion/20 bg-vermillion-wash font-display text-lg leading-none text-inari-vermillion"
            >
              友
            </span>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
              Welcome back
            </p>
          </div>
          <h1
            id="dashboard-heading"
            className="mt-3 max-w-[29ch] font-display text-[1.55rem] font-medium leading-[1.12] text-sumi-ink text-balance sm:text-[1.85rem] lg:text-[2.15rem]"
          >
            {greeting}
          </h1>
        </div>

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-end">
          <div className="relative min-w-[12.5rem] overflow-hidden border border-soft-hairline bg-warm-paper-raised/90 px-3.5 py-2.5">
            <span
              lang="ja"
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-2 select-none font-display text-3xl leading-none text-inari-vermillion/[0.055]"
            >
              暦
            </span>
            <div className="flex items-baseline justify-between gap-3 border-b border-soft-hairline/70 pb-1.5">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
                Today
              </p>
              <span lang="ja" className="font-display text-sm leading-none text-inari-vermillion">
                本日
              </span>
            </div>
            <time
              dateTime={dateTime}
              aria-label={dateLabel}
              className="mt-2 block"
            >
              <span className="block font-mono text-sm tabular-nums text-sumi-ink">
                {mastheadDate.englishDate}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.6875rem] text-faded-sumi">
                <span>{mastheadDate.englishWeekday}</span>
                {mastheadDate.weekdayKanji !== null && (
                  <span lang="ja" className="text-inari-vermillion/85">
                    {mastheadDate.weekdayKanji}
                  </span>
                )}
                <span aria-hidden="true" className="text-faded-sumi/45">·</span>
                <span lang="ja">
                  {mastheadDate.japaneseDate}
                </span>
              </span>
            </time>
          </div>
        </div>
      </div>
    </section>
  )
}

function formatLearnerMastheadDate(
  dateTime:  string,
  dateLabel: string,
): {
  englishDate:    string
  englishWeekday: string
  japaneseDate:   string
  weekdayKanji:   string | null
} {
  const [, month, day] = dateTime.split('-').map(Number)
  const [englishWeekdayRaw, ...englishDateParts] = dateLabel.split(', ')
  const englishWeekday = englishWeekdayRaw ?? 'Today'
  const englishDate = englishDateParts.length > 0 ? englishDateParts.join(', ') : dateLabel
  const japaneseDate = Number.isFinite(month) && Number.isFinite(day)
    ? `${month}月${day}日`
    : dateLabel
  const weekdayKanji = JAPANESE_WEEKDAY_BY_ENGLISH[englishWeekday ?? ''] ?? null

  return {
    englishDate,
    englishWeekday: englishDateParts.length > 0 ? englishWeekday : 'Today',
    japaneseDate,
    weekdayKanji,
  }
}

const JAPANESE_WEEKDAY_BY_ENGLISH: Record<string, string> = {
  Sunday:    '日',
  Monday:    '月',
  Tuesday:   '火',
  Wednesday: '水',
  Thursday:  '木',
  Friday:    '金',
  Saturday:  '土',
}

function DashboardDevToolsPanel({
  heroControls,
  moduleControls,
  onHeroChange,
  onModuleChange,
  onClose,
}: {
  heroControls:   HeroDevControls
  moduleControls: ModuleDevControls
  onHeroChange:   (next: HeroDevControls) => void
  onModuleChange: (next: ModuleDevControls) => void
  onClose:        () => void
}): React.JSX.Element {
  return (
    <section
      id="dashboard-dev-tools"
      aria-label="Dashboard dev tools"
      className={[
        'fixed bottom-16 left-4 right-4 z-40 grid max-h-[calc(100vh-6rem)] gap-3 overflow-y-auto',
        'lg:left-auto lg:w-[min(58rem,calc(100vw-23rem))] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]',
      ].join(' ')}
    >
      <div className="col-span-full flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className={[
            'inline-flex h-9 items-center rounded-[2px] border border-sumi-ink/15',
            'bg-sumi-ink px-3 font-mono text-xs tracking-wide text-warm-paper-raised',
            'dashboard-motion-colors',
            'hover:bg-sumi-ink/90',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion',
          ].join(' ')}
        >
          Close preview controls
        </button>
      </div>
      <DashboardHeroDevToolbar
        variant="panel"
        controls={heroControls}
        onChange={onHeroChange}
      />
      <DashboardModulesDevToolbar
        variant="panel"
        controls={moduleControls}
        onChange={onModuleChange}
      />
    </section>
  )
}

/**
 * Client wrapper that fetches dashboard data via TanStack Query and composes
 * the module grid. Each module receives its own loading / error / empty
 * state derived from its own query result, so the dashboard can render
 * partially while slower endpoints catch up.
 *
 * Unwired modules render an unavailable state instead of a false empty state.
 */
export function DashboardClient({
  dateLabel,
  dateTime,
  greetingName,
  greetingPrefix,
  timeZone,
}: DashboardClientProps): React.JSX.Element {
  const [heroControls, setHeroControls] = useState<HeroDevControls>(DEFAULT_HERO_DEV_CONTROLS)
  const [moduleControls, setModuleControls] = useState<ModuleDevControls>(DEFAULT_MODULE_DEV_CONTROLS)
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const [calendar, setCalendar] = useState<DashboardCalendarContext>(() => ({
    dateLabel,
    dateTime,
    greetingPrefix,
    todayKey:     dateTime,
    yesterdayKey: addDaysToDateKey(dateTime, -1),
    timeZone:     normalizeDashboardTimeZone(timeZone),
  }))
  const previewActive = HERO_PREVIEW_ENABLED && devToolsOpen

  useEffect(() => {
    function syncCalendar(): void {
      setCalendar((current) => {
        const next = buildDashboardCalendarContext(new Date(), timeZone)
        return dashboardCalendarContextMatches(current, next) ? current : next
      })
    }

    syncCalendar()
    const intervalId = window.setInterval(syncCalendar, 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [timeZone])

  const heatmapQuery = useHeatmapData()
  const practiceGreeting = useMemo(
    () => buildPracticeGreetingCopy({
      days:         heatmapQuery.data?.items ?? [],
      isLoading:    heatmapQuery.isLoading,
      todayKey:     calendar.todayKey,
      yesterdayKey: calendar.yesterdayKey,
    }),
    [calendar.todayKey, calendar.yesterdayKey, heatmapQuery.data, heatmapQuery.isLoading],
  )

  useEffect(() => {
    if (!HERO_PREVIEW_ENABLED) return

    function handleToggle(): void {
      setDevToolsOpen((open) => !open)
    }

    window.addEventListener(DASHBOARD_DEV_TOOLS_TOGGLE_EVENT, handleToggle)
    return () => window.removeEventListener(DASHBOARD_DEV_TOOLS_TOGGLE_EVENT, handleToggle)
  }, [])

  useEffect(() => {
    if (!devToolsOpen) return

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setDevToolsOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [devToolsOpen])

  // ── Deck source of truth ────────────────────────────────────────────────
  // Source: GET /api/v1/decks. The hero uses this same metadata so deck
  // titles and tags match the list below.
  const decksQuery = useDecks()
  const deckById = useMemo(() => {
    return new Map((decksQuery.data?.items ?? []).map((deck) => [deck.id, deck]))
  }, [decksQuery.data])

  // ── Hero / queue ────────────────────────────────────────────────────────
  // Source: GET /api/v1/reviews/due plus deck metadata above.
  const dueQuery = useDueCards()
  const liveTodayBreakdown = useMemo(
    () => dueQuery.data === undefined
      ? null
      : countQueueBreakdown(dueQuery.data.items ?? [], calendar.todayKey, calendar.timeZone),
    [calendar.todayKey, calendar.timeZone, dueQuery.data],
  )

  const liveHeroVariant = useMemo<DashboardHeroVariant>(() => {
    if (dueQuery.isLoading || decksQuery.isLoading) return { kind: 'loading' as const }
    if (dueQuery.isError)   return { kind: 'error'   as const }

    const items = dueQuery.data?.items ?? []
    if (items.length === 0) return { kind: 'caught-up' as const }

    return {
      kind:  'due' as const,
      queue: buildHeroQueueFromDueCards(items, calendar.todayKey, calendar.timeZone, deckById),
    }
  }, [
    calendar.todayKey,
    calendar.timeZone,
    deckById,
    decksQuery.isLoading,
    dueQuery.isLoading,
    dueQuery.isError,
    dueQuery.data,
  ])
  const previewHeroVariant = useMemo(
    () => buildPreviewHeroVariant(heroControls),
    [heroControls],
  )
  const heroVariant = previewActive ? previewHeroVariant : liveHeroVariant

  // ── Forecast ────────────────────────────────────────────────────────────
  // Source: GET /api/v1/reviews/forecast (existing).
  const forecastQuery = useReviewForecast()
  const forecastState: ModuleState =
    forecastQuery.isLoading ? 'loading' :
    forecastQuery.isError   ? 'error'   :
    'default'

  // Always generate a full 14-day series (today + next 13). Days the API
  // didn't return get count=0 so the chart renders empty bars (1px placeholder
  // at the baseline) instead of leaving gaps. The forecast component slices
  // to 7 days on mobile and 14 on desktop; padding here means both viewports
  // have a complete week regardless of how many days the API returned. Future
  // days use the forecast endpoint's own backlog / review / new split, so the
  // chart reflects actual new-card inventory instead of the daily limit. The
  // due queue patches today's backlog because it is the user's current route.
  const forecastDays = useMemo(() => {
    return buildPaddedForecast(
      forecastQuery.data?.items ?? [],
      FORECAST_HORIZON_DAYS,
      calendar.todayKey,
      liveTodayBreakdown,
    )
  }, [calendar.todayKey, forecastQuery.data, liveTodayBreakdown])
  const previewForecastDays = useMemo(
    () => buildPreviewForecastDays(previewQueueBreakdown(heroControls), calendar.todayKey),
    [calendar.todayKey, heroControls],
  )
  const effectiveForecastState = previewActive
    ? previewStateToModuleState(moduleControls.forecast)
    : forecastState
  const effectiveForecastDays = previewActive
    ? (isPreviewEmpty(moduleControls.forecast) ? [] : previewForecastDays)
    : forecastDays

  // ── Active decks ────────────────────────────────────────────────────────
  // The list endpoint has deck names and card counts, but not due/mastery
  // rollups yet. Render the real decks with lighter metadata instead of
  // claiming the learner has no decks.
  const liveDecks = useMemo(
    () => (decksQuery.data?.items ?? []).map(toDashboardDeck),
    [decksQuery.data],
  )
  const liveDecksState: ModuleState =
    decksQuery.isLoading ? 'loading' :
    decksQuery.isError   ? 'error'   :
    'default'
  const decksState = previewActive
    ? previewStateToModuleState(moduleControls.decks)
    : liveDecksState
  const decks = previewActive
    ? (isPreviewEmpty(moduleControls.decks) ? [] : PREVIEW_DECKS)
    : liveDecks

  // ── Weak spots ──────────────────────────────────────────────────────────
  // The leech table exists server-side, but there is no dashboard list route
  // yet. Render an unavailable state, not "0 weak spots."
  const liveLeeches: Leech[] = []
  const liveLeechesState: ModuleState = 'unavailable'
  const leechesState = previewActive
    ? previewStateToModuleState(moduleControls.leeches)
    : liveLeechesState
  const leeches = previewActive
    ? (isPreviewEmpty(moduleControls.leeches) ? [] : PREVIEW_LEECHES)
    : liveLeeches

  // ── Recent activity ─────────────────────────────────────────────────────
  // Heatmap already carries date, review count, and retention for reviewed
  // days. Fill the seven-day rhythm locally so the dashboard uses live data.
  const liveRecent = useMemo(
    () => buildRecentActivityRows(heatmapQuery.data?.items ?? [], calendar.todayKey),
    [calendar.todayKey, heatmapQuery.data],
  )
  const liveRecentState: ModuleState =
    heatmapQuery.isLoading ? 'loading' :
    heatmapQuery.isError   ? 'error'   :
    'default'
  const recentState = previewActive
    ? previewStateToModuleState(moduleControls.recent)
    : liveRecentState
  const recent = previewActive
    ? (isPreviewEmpty(moduleControls.recent) ? [] : PREVIEW_RECENT)
    : liveRecent

  // ── Practice signal ─────────────────────────────────────────────────────
  // Personalized signals need a future API. Keep the module honest and avoid
  // turning Tomo into a speaking character in normal dashboard chrome.
  const liveInsight: PracticeInsight | null = null
  const liveSignalState: ModuleState = 'unavailable'
  const signalState = previewActive
    ? previewStateToModuleState(moduleControls.tomo)
    : liveSignalState
  const insight = previewActive
    ? (isPreviewEmpty(moduleControls.tomo) ? null : PREVIEW_PRACTICE_SIGNAL)
    : liveInsight
  const heroMotionKey = heroVariant.kind === 'due'
    ? `due-${heroVariant.queue.total}-${heroVariant.queue.newCnt}-${heroVariant.queue.review}-${heroVariant.queue.backlog}`
    : heroVariant.kind
  const forecastMotionKey = `${effectiveForecastState}-${effectiveForecastDays.length}-${effectiveForecastDays.reduce((sum, day) => sum + day.count, 0)}`
  const signalMotionKey = `${signalState}-${insight?.date ?? 'none'}`
  const decksMotionKey = `${decksState}-${decks.length}`
  const leechesMotionKey = `${leechesState}-${leeches.length}`
  const recentMotionKey = `${recentState}-${recent.length}`

  return (
    <>
      <DashboardMasthead
        dateLabel={calendar.dateLabel}
        dateTime={calendar.dateTime}
        greetingName={greetingName}
        greetingPrefix={calendar.greetingPrefix}
        practiceGreeting={practiceGreeting}
      />

      <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
        {previewActive && (
          <DashboardDevToolsPanel
            heroControls={heroControls}
            moduleControls={moduleControls}
            onHeroChange={setHeroControls}
            onModuleChange={setModuleControls}
            onClose={() => setDevToolsOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-12">

          {/* Hero, full-width centered editorial */}
          <DashboardModuleReveal className="md:col-span-12">
            <DashboardStatePresence stateKey={heroMotionKey}>
              <DashboardHero variant={heroVariant} />
            </DashboardStatePresence>
          </DashboardModuleReveal>

          {/* Forecast + practice signal */}
          <DashboardModuleReveal className="md:col-span-8">
            <DashboardStatePresence stateKey={forecastMotionKey}>
              <ForecastChart state={effectiveForecastState} days={effectiveForecastDays} />
            </DashboardStatePresence>
          </DashboardModuleReveal>
          <DashboardModuleReveal className="md:col-span-4">
            <DashboardStatePresence stateKey={signalMotionKey}>
              <PracticeSignal
                state={signalState}
                insight={insight}
              />
            </DashboardStatePresence>
          </DashboardModuleReveal>

          {/* Active decks (full-width) */}
          <DashboardModuleReveal className="md:col-span-12">
            <DashboardStatePresence stateKey={decksMotionKey}>
              <ActiveDecks state={decksState} decks={decks} />
            </DashboardStatePresence>
          </DashboardModuleReveal>

          {/* Tier 2: Leeches and recent activity */}
          <DashboardModuleReveal className="md:col-span-12 lg:col-span-6">
            <DashboardStatePresence stateKey={leechesMotionKey}>
              <Leeches state={leechesState} leeches={leeches} />
            </DashboardStatePresence>
          </DashboardModuleReveal>
          <DashboardModuleReveal className="md:col-span-12 lg:col-span-6">
            <DashboardStatePresence stateKey={recentMotionKey}>
              <RecentActivity state={recentState} rows={recent} />
            </DashboardStatePresence>
          </DashboardModuleReveal>

        </div>
      </div>
    </>
  )
}
