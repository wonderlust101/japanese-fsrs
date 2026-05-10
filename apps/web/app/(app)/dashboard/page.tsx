import type { Metadata } from 'next'
import Link from 'next/link'

import { TopBar } from '../_components/top-bar'

import { ActiveDecks, type ActiveDeck } from './_components/active-decks'
import { DashboardHero } from './_components/dashboard-hero'
import { ForecastChart } from './_components/forecast-chart'
import { JlptProgress, type JlptLevelProgress } from './_components/jlpt-progress'
import { Leeches, type Leech } from './_components/leeches'
import { NoteFromTomo, type DailyIdiom, type TomoInsight } from './_components/note-from-tomo'
import { RecentActivity, type ActivityRow } from './_components/recent-activity'
import type { ModuleState } from './_components/section-primitives'
import { StateSwitcher } from './_components/state-switcher'
import { StatStrip } from './_components/stat-strip'

export const metadata: Metadata = { title: 'Dashboard' }

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_QUEUE = {
  total:      18,
  newCnt:     7,
  review:     11,
  hasLeeches: true,
}

const MOCK_STREAK_DAYS      = 12
const MOCK_REVIEWS_THIS_WK  = 88
const MOCK_RETENTION_PCT    = 87
// 13 future days; combined with todayCount this produces a 14-day series.
// Mobile + tablet show the first 7 (today + next 6); desktop shows the full
// 14-day window so the SR review beat (1d / 3d / 7d / 14d intervals) is
// visible across the chart.
const MOCK_FUTURE_FORECAST  = [12, 8, 22, 15, 6, 20, 14, 9, 11, 16, 22, 8, 17]

const MOCK_DECKS: ActiveDeck[] = [
  {
    id: 'n5-vocabulary', title: 'JLPT N5 Vocabulary', level: 'N5',
    dueCount: 8, totalCards: 250, newCount: 2, reviewCount: 6,
    masteryPercent: 70, lastReviewedRel: '2h ago',
  },
  {
    id: 'joyo-set-1', title: 'Joyo Kanji Set 1', level: null,
    dueCount: 5, totalCards: 80, newCount: 0, reviewCount: 5,
    masteryPercent: 35, lastReviewedRel: 'yesterday',
  },
  {
    id: 'n4-grammar', title: 'JLPT N4 Grammar Patterns', level: 'N4',
    dueCount: 5, totalCards: 100, newCount: 1, reviewCount: 4,
    masteryPercent: 28, lastReviewedRel: '3d ago',
  },
  {
    id: 'beyond-literature', title: 'Beyond JLPT: Literature', level: 'beyond_jlpt',
    dueCount: 0, totalCards: 45, newCount: 0, reviewCount: 0,
    masteryPercent: 5, lastReviewedRel: null,
  },
]

const MOCK_LEECHES: Leech[] = [
  { cardId: 'card-1', word: '食べる',   reading: 'たべる',   errors: 3 },
  { cardId: 'card-2', word: '行きます', reading: 'いきます', errors: 4 },
  { cardId: 'card-3', word: '学校',     reading: 'がっこう', errors: 3 },
  { cardId: 'card-4', word: '読みます', reading: 'よみます', errors: 5 },
  { cardId: 'card-5', word: '友達',     reading: 'ともだち', errors: 3 },
]

const MOCK_RECENT_ACTIVITY: ActivityRow[] = [
  { date: 'Today',     reviewed: null, retention: null },
  { date: 'Friday',    reviewed: 22,   retention: 0.92 },
  { date: 'Thursday',  reviewed: 18,   retention: 0.88 },
  { date: 'Wednesday', reviewed: 0,    retention: null },
  { date: 'Tuesday',   reviewed: 24,   retention: 0.91 },
  { date: 'Monday',    reviewed: 18,   retention: 0.85 },
  { date: 'Sunday',    reviewed: 16,   retention: 0.89 },
]

const MOCK_JLPT_PROGRESS: JlptLevelProgress[] = [
  { level: 'N5',          percent: 100 },
  { level: 'N4',          percent: 67 },
  { level: 'N3',          percent: 46 },
  { level: 'N2',          percent: 26 },
  { level: 'N1',          percent: 12 },
  { level: 'beyond_jlpt', percent: 2 },
]

const MOCK_INSIGHT: TomoInsight = {
  date: 'Saturday',
  body: (
    <>
      You&apos;ve slowed on negative-form verbs this week. Here&apos;s one to
      remember:{' '}
      <span lang="ja" className="font-medium text-sumi-ink">行かない</span>{' '}
      <span className="text-faded-sumi">(ikanai), &quot;won&apos;t go.&quot;</span>
    </>
  ),
}

const MOCK_IDIOM: DailyIdiom = {
  date:    'Saturday',
  word:    '猿も木から落ちる',
  reading: 'さるも きから おちる',
  meaning: 'Even monkeys fall from trees. Everyone, no matter how skilled, makes mistakes sometimes.',
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const DAY_GLYPHS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

function formatEditorialDate(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const day     = d.getDate()
  const month   = d.toLocaleDateString('en-US', { month: 'long' })
  return `${weekday} · ${day} ${month}`
}

function buildForecastDays(today: Date, todayCount: number, futureCounts: number[]): { label: string; count: number; isToday: boolean }[] {
  const counts = [todayCount, ...futureCounts]
  return counts.map((count, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return {
      label:   DAY_GLYPHS[d.getDay()] ?? '',
      count,
      isToday: i === 0,
    }
  })
}

// ── State resolution ──────────────────────────────────────────────────────────

type DashboardState = 'default' | 'caught-up' | 'first-time' | 'empty' | 'loading' | 'error'
type NoteVariant    = 'insight' | 'idiom'

function resolveState(raw: string | string[] | undefined): DashboardState {
  switch (raw) {
    case 'caught-up':
    case 'caughtup':  return 'caught-up'
    case 'first-time':
    case 'firsttime': return 'first-time'
    case 'empty':     return 'empty'
    case 'loading':   return 'loading'
    case 'error':     return 'error'
    default:          return 'default'
  }
}

function resolveNote(raw: string | string[] | undefined): NoteVariant {
  return raw === 'idiom' ? 'idiom' : 'insight'
}

function moduleStateFor(state: DashboardState): ModuleState {
  if (state === 'loading') return 'loading'
  if (state === 'error')   return 'error'
  return 'default'
}

// ── Header sub-components ─────────────────────────────────────────────────────

function DashboardHeader({ dateLabel }: { dateLabel: string }): React.JSX.Element {
  return (
    <>
      {/* Mobile: just the brand chrome (TopBar already injects hamburger + Logo) */}
      <span className="lg:hidden ml-auto" />

      {/* Desktop: editorial date left, Add Card right, edge-aligned to body column */}
      <div className="hidden lg:flex flex-1 items-center justify-between max-w-[1360px] mx-auto">
        <p className="font-mono text-sm tracking-wide text-faded-sumi">
          {dateLabel}
        </p>
        <AddCardAffordance />
      </div>
    </>
  )
}

function AddCardAffordance(): React.JSX.Element {
  return (
    <Link
      href="/decks/new"
      className={[
        'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[2px]',
        'bg-inari-vermillion text-warm-paper-raised',
        'text-sm font-medium',
        'transition-colors duration-150 ease-out',
        'hover:bg-inari-vermillion-deep',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
      ].join(' ')}
    >
      <span className="font-mono text-base leading-none translate-y-[-1px]" aria-hidden="true">+</span>
      <span>Add card</span>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; note?: string }>
}): Promise<React.JSX.Element> {
  const params      = await searchParams
  const state       = resolveState(params.state)
  const noteVariant = resolveNote(params.note)

  const today       = new Date()
  const dateLabel   = formatEditorialDate(today)

  const moduleState = moduleStateFor(state)

  // Hero variant — empty state borrows the caught-up shell so the page chrome
  // stays intact while every data module collapses to its empty fallback.
  const heroVariant =
    state === 'first-time' ? { kind: 'first-time' as const }
    : state === 'loading'   ? { kind: 'loading'    as const }
    : state === 'error'     ? { kind: 'error'      as const }
    : state === 'caught-up' ? { kind: 'caught-up'  as const }
    : state === 'empty'     ? { kind: 'caught-up'  as const }
    : { kind: 'due' as const, queue: MOCK_QUEUE }

  const isEmpty = state === 'empty'

  const cardsToday   = (state === 'caught-up' || isEmpty) ? 0 : MOCK_QUEUE.total
  const forecastSeed = isEmpty ? [0, 0, 0, 0, 0, 0] : MOCK_FUTURE_FORECAST
  const forecastDays = buildForecastDays(today, cardsToday, forecastSeed)

  const decks   = isEmpty ? [] : MOCK_DECKS
  const leeches = isEmpty ? [] : MOCK_LEECHES
  const recent  = isEmpty ? [] : MOCK_RECENT_ACTIVITY
  const jlpt    = isEmpty ? [] : MOCK_JLPT_PROGRESS

  const streak    = isEmpty ? 0 : MOCK_STREAK_DAYS
  const reviews   = isEmpty ? 0 : MOCK_REVIEWS_THIS_WK
  const retention = isEmpty ? 0 : MOCK_RETENTION_PCT

  // Note from Tomo: in empty state, no insight available — fall back to idiom.
  // Otherwise honor the URL-resolved note variant.
  const insightForNote = isEmpty
    ? null
    : (noteVariant === 'insight' ? MOCK_INSIGHT : null)
  const idiomForNote   = MOCK_IDIOM

  return (
    <>
      <TopBar>
        <DashboardHeader dateLabel={dateLabel} />
      </TopBar>

      <div className="px-6 lg:px-10 pt-8 pb-24 lg:pt-16 lg:pb-32">
        <div className="max-w-[1360px] mx-auto">

          {state === 'first-time' ? (
            <DashboardHero variant={heroVariant} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-8 lg:gap-y-12">

              {/* Hero — full-width centered editorial */}
              <div className="lg:col-span-12">
                <DashboardHero variant={heroVariant} />
              </div>

              {/* Stats (col-7) + Note from Tomo (col-5) */}
              <div className="lg:col-span-7">
                <StatStrip
                  state={moduleState}
                  streakDays={streak}
                  reviewsThisWeek={reviews}
                  retentionPct={retention}
                />
              </div>
              <div className="lg:col-span-5">
                <NoteFromTomo
                  state={moduleState}
                  insight={insightForNote}
                  idiom={idiomForNote}
                />
              </div>

              {/* Forecast chart (full-width) */}
              <div className="lg:col-span-12">
                <ForecastChart state={moduleState} days={forecastDays} />
              </div>

              {/* Active decks (full-width) */}
              <div className="lg:col-span-12">
                <ActiveDecks state={moduleState} decks={decks} />
              </div>

              {/* Tier 2: Leeches (col-6) + Recent activity (col-6) */}
              <div className="lg:col-span-6">
                <Leeches state={moduleState} leeches={leeches} />
              </div>
              <div className="lg:col-span-6">
                <RecentActivity state={moduleState} rows={recent} />
              </div>

              {/* JLPT progress (full-width) */}
              <div className="lg:col-span-12">
                <JlptProgress state={moduleState} levels={jlpt} />
              </div>

            </div>
          )}

        </div>
      </div>

      <StateSwitcher current={state} noteVariant={noteVariant} />
    </>
  )
}
