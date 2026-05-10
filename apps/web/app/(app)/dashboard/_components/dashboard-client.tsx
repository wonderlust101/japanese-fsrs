'use client'

import { useMemo } from 'react'

import { useJlptGap, useStreak } from '@/lib/api/analytics'
import { useDueCards, useReviewForecast } from '@/lib/api/reviews'

import { ActiveDecks, type ActiveDeck } from './active-decks'
import { DashboardHero } from './dashboard-hero'
import { ForecastChart } from './forecast-chart'
import { JlptProgress, type JlptLevelProgress } from './jlpt-progress'
import { Leeches, type Leech } from './leeches'
import { NoteFromTomo, type TomoInsight } from './note-from-tomo'
import { RecentActivity, type ActivityRow } from './recent-activity'
import type { ModuleState } from './section-primitives'
import { StatStrip } from './stat-strip'

const DAY_GLYPHS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/**
 * Client wrapper that fetches dashboard data via TanStack Query and composes
 * the module grid. Each module receives its own loading / error / empty
 * state derived from its own query result, so the dashboard can render
 * partially while slower endpoints catch up.
 *
 * Modules without backing API routes pass empty data with state='default',
 * which causes their presentation components to render their editorial
 * empty-state copy. TODO comments inside this file mark each missing route.
 */
export function DashboardClient(): React.JSX.Element {
  // ── Hero / queue ────────────────────────────────────────────────────────
  // Source: GET /api/v1/reviews/due (existing).
  const dueQuery = useDueCards()

  const heroVariant = useMemo(() => {
    if (dueQuery.isLoading) return { kind: 'loading' as const }
    if (dueQuery.isError)   return { kind: 'error'   as const }

    const items = dueQuery.data?.items ?? []
    if (items.length === 0) return { kind: 'caught-up' as const }

    // FSRS State enum: 0 = New, 1 = Learning, 2 = Review, 3 = Relearning.
    // For the hero summary "X new · Y review", we count state 0 as new and
    // everything else as review. Learning and relearning are mid-cycle and
    // read most naturally to the user as "review" cards.
    const newCnt = items.filter((c) => c.state === 0).length
    const review = items.length - newCnt

    return {
      kind: 'due' as const,
      queue: {
        total:      items.length,
        newCnt,
        review,
        // TODO: API route needed for "leeches forming" detection. Until then,
        // hide the Drill leeches CTA in the hero.
        hasLeeches: false,
      },
    }
  }, [dueQuery.isLoading, dueQuery.isError, dueQuery.data])

  // ── Stats / week snapshot ───────────────────────────────────────────────
  // Source: GET /api/v1/analytics/streak (existing).
  // TODO: API route needed for "reviews this week" aggregate count.
  // TODO: API route needed for "retention this week" weekly average.
  const streakQuery = useStreak()
  const statsState: ModuleState =
    streakQuery.isLoading ? 'loading' :
    streakQuery.isError   ? 'error'   :
    'default'

  // ── Forecast ────────────────────────────────────────────────────────────
  // Source: GET /api/v1/reviews/forecast (existing).
  const forecastQuery = useReviewForecast()
  const forecastState: ModuleState =
    forecastQuery.isLoading ? 'loading' :
    forecastQuery.isError   ? 'error'   :
    'default'

  const forecastDays = useMemo(() => {
    const apiDays = forecastQuery.data?.items ?? []
    const today   = new Date()
    today.setHours(0, 0, 0, 0)

    return apiDays.map((d) => {
      const date    = new Date(d.date)
      const dayIdx  = date.getDay()
      const isToday = date.toDateString() === today.toDateString()
      return {
        label:   DAY_GLYPHS[dayIdx] ?? '',
        count:   d.count,
        isToday,
      }
    })
  }, [forecastQuery.data])

  // ── Active decks ────────────────────────────────────────────────────────
  // TODO: API route needed for the user's deck list with the v6 fields:
  //   masteryPercent, totalCards, newCount, reviewCount, lastReviewedRel.
  // GET /api/v1/decks exists but returns the lighter ApiDeck shape; the
  // dashboard row needs an extended response (perhaps ApiDeckWithStats++).
  const decks: ActiveDeck[] = []
  const decksState: ModuleState = 'default'

  // ── Leeches ─────────────────────────────────────────────────────────────
  // TODO: API route needed for "leeches forming" — cards over the leech
  // threshold (default 8 lapses) ranked by lapse count.
  const leeches: Leech[] = []
  const leechesState: ModuleState = 'default'

  // ── Recent activity ─────────────────────────────────────────────────────
  // TODO: API route needed (or derive from /analytics/heatmap) for the
  // last 7 days of {date, reviewed, retention}.
  const recent: ActivityRow[] = []
  const recentState: ModuleState = 'default'

  // ── JLPT progress ───────────────────────────────────────────────────────
  // Source: GET /api/v1/analytics/jlpt-gap (existing).
  const jlptQuery = useJlptGap()
  const jlptState: ModuleState =
    jlptQuery.isLoading ? 'loading' :
    jlptQuery.isError   ? 'error'   :
    'default'

  const jlptLevels: JlptLevelProgress[] = useMemo(() => {
    const items = jlptQuery.data?.items ?? []
    return items.map((g) => ({
      level:   g.jlptLevel,
      percent: Math.round(g.progressPct),
    }))
  }, [jlptQuery.data])

  // ── Note from Tomo ──────────────────────────────────────────────────────
  // TODO: API route needed for paid-tier daily insight (POST /ai/daily-insight
  // or GET /tomo/insight).
  // TODO: API route needed for the daily idiom rotation
  // (GET /tomo/idiom or static seed).
  const insight: TomoInsight | null = null
  const tomoState: ModuleState = 'default'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-16 gap-y-14">

      {/* Hero — full-width centered editorial */}
      <div className="lg:col-span-12">
        <DashboardHero variant={heroVariant} />
      </div>

      {/* Snapshot row: Stats (col-7) + Note from Tomo (col-5) */}
      <div className="lg:col-span-7">
        <StatStrip
          state={statsState}
          streakDays={streakQuery.data?.currentStreak ?? 0}
          reviewsThisWeek={0}
          retentionPct={0}
        />
      </div>
      <div className="lg:col-span-5">
        <NoteFromTomo
          state={tomoState}
          insight={insight}
        />
      </div>

      {/* Forecast (full-width) */}
      <div className="lg:col-span-12">
        <ForecastChart state={forecastState} days={forecastDays} />
      </div>

      {/* Active decks (full-width) */}
      <div className="lg:col-span-12">
        <ActiveDecks state={decksState} decks={decks} />
      </div>

      {/* Tier 2: Leeches (col-6) + Recent activity (col-6) */}
      <div className="lg:col-span-6">
        <Leeches state={leechesState} leeches={leeches} />
      </div>
      <div className="lg:col-span-6">
        <RecentActivity state={recentState} rows={recent} />
      </div>

      {/* JLPT progress (full-width) */}
      <div className="lg:col-span-12">
        <JlptProgress state={jlptState} levels={jlptLevels} />
      </div>

    </div>
  )
}
