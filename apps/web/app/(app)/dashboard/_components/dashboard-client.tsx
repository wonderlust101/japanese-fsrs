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
        // TODO: needs API support for the "Drill leeches" hero CTA flag.
        //
        // Route options (cheapest first):
        //   1. Add `hasLeeches: boolean` to the existing GET /api/v1/reviews/due
        //      response envelope. Cheapest because the route already runs;
        //      one extra `SELECT EXISTS(...)` against review_logs / cards
        //      filtered by lapse_count >= LEECH_THRESHOLD env var (default 8).
        //   2. Or add it once the leeches list endpoint below ships — the hero
        //      flag becomes `leechesQuery.data.items.length > 0`, and this
        //      `hasLeeches: false` literal goes away entirely.
        //
        // Until either lands, the Drill leeches CTA stays suppressed and
        // users reach drill mode only via the Leeches card's "drill all →".
        hasLeeches: false,
      },
    }
  }, [dueQuery.isLoading, dueQuery.isError, dueQuery.data])

  // ── Stats / week snapshot ───────────────────────────────────────────────
  // Source: GET /api/v1/analytics/streak (existing) for currentStreak only.
  //
  // TODO: needs a single weekly-aggregate API route to populate the other
  // two stat tiles (reviewsThisWeek + retentionPct). Two implementation paths:
  //
  //   PATH A — extend an existing route (cheapest):
  //     The /api/v1/analytics/heatmap response already returns daily
  //     {date, reviewed, retention} for ~30-90 days. The web client could
  //     filter to the last 7 days and aggregate (sum reviews, weighted-mean
  //     retention) without a new endpoint. Risk: heatmap returns more rows
  //     than needed and ships extra bytes for unused days.
  //
  //   PATH B — new bundled endpoint (cleaner):
  //     GET /api/v1/analytics/week-summary
  //       → { reviewsThisWeek: number, retentionThisWeek: number,
  //           weekStart: string }
  //     SQL: SELECT SUM(reviewed_count), AVG(retention) FROM
  //          analytics_daily_summary WHERE user_id = $1
  //          AND date >= NOW() - INTERVAL '7 days'.
  //     Cache via Upstash for 5 minutes; invalidate on review submit.
  //
  // Current behavior: streakDays is real, the other two stats render 0.
  // Stats card already handles 0/0/0% as a quiet "fresh account" empty state.
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
  // TODO: needs an extended deck-with-stats API.
  //
  // Current state of the API:
  //   GET /api/v1/decks → ApiList<ApiDeck>            (id, name, jlpt_level)
  //   ApiDeckWithStats already exists in shared-types and adds:
  //     + dueCount, newCount
  //   …but the route doesn't return it on the list endpoint, only on detail.
  //
  // What the dashboard row needs (from active-decks.tsx ActiveDeck type):
  //   - title              (have, in ApiDeck.name)
  //   - level              (have, in ApiDeck.jlptLevel)
  //   - dueCount           (in ApiDeckWithStats — promote to list response)
  //   - newCount           (in ApiDeckWithStats — promote to list response)
  //   - reviewCount        (NEW — count of cards with state IN (2, 3) due today)
  //   - totalCards         (NEW — count(*) of cards in deck for this user)
  //   - masteryPercent     (NEW — count(state=2) / total, rounded to nearest %)
  //   - lastReviewedRel    (NEW — relative-time string from MAX(review_logs.reviewed_at))
  //
  // Route options:
  //   1. Extend GET /api/v1/decks default response to return ApiDeckWithStats++
  //      (adds 4 fields). Single SQL query with LATERAL JOIN against cards +
  //      review_logs. Best if the dashboard is the primary consumer.
  //   2. Add ?include=stats query param so the lighter shape stays the default.
  //   3. New GET /api/v1/decks/dashboard returning a tailor-made shape.
  //
  // Web side: add a `useDecks()` hook in apps/web/lib/api/ (similar to
  // usePremadeDecks in premade.ts) once the API shape lands.
  //
  // Until the route ships, decks render the editorial empty state:
  //   "Quiet shelf. Pick a deck to begin. Browse decks →"
  // Note that this is technically wrong for users WITH decks — they'd see the
  // "no decks" copy even though they have decks. That's why this is the most
  // urgent of the missing routes.
  const decks: ActiveDeck[] = []
  const decksState: ModuleState = 'default'

  // ── Leeches ─────────────────────────────────────────────────────────────
  // TODO: needs a leeches-list API.
  //
  // Definition of a leech (per CLAUDE.md, configurable via LEECH_THRESHOLD
  // env var, default 8):
  //   A card whose lapse_count >= LEECH_THRESHOLD. Lapse count is the
  //   number of times the user has rated the card "Again" after it had
  //   already graduated to Review state.
  //
  // Detection runs inside processReview (apps/api/src/services/fsrs.service.ts)
  // and writes to a leeches table (or a flag on cards). The data is there;
  // the dashboard just needs a query route to surface it.
  //
  // Proposed route:
  //   GET /api/v1/reviews/leeches?limit=5
  //     → { items: Leech[], nextCursor: null, hasMore: false }
  //   where Leech = { cardId, word, reading, errors }
  //   - errors = lapse_count
  //   - sorted by errors DESC, then by recency
  //   - limit defaults to 5 to fit the dashboard card; bumpable for the
  //     full Drill leeches review surface
  //
  // SQL sketch:
  //   SELECT c.id, c.word, c.reading, c.lapse_count
  //     FROM cards c
  //    WHERE c.user_id = $1
  //      AND c.lapse_count >= $2  -- LEECH_THRESHOLD
  //    ORDER BY c.lapse_count DESC, c.last_reviewed_at DESC
  //    LIMIT $3
  //
  // Web side: add `useLeeches()` hook in apps/web/lib/api/reviews.ts. Cache
  // briefly (60s) since the count changes only on review submit; invalidate
  // on the same useSubmitReview onSettled list as /reviews/due.
  //
  // Until the route ships, leeches render the editorial empty state:
  //   "No leeches forming. Your cards are settling well."
  // For users who DO have leeches, this misrepresents reality. Combined with
  // the Hero `hasLeeches` flag above, the entire leech-detection surface is
  // currently invisible.
  const leeches: Leech[] = []
  const leechesState: ModuleState = 'default'

  // ── Recent activity ─────────────────────────────────────────────────────
  // TODO: needs API support for the last-7-days rollup (or web-side
  // derivation from existing data).
  //
  // The Recent card needs ActivityRow[] where ActivityRow is:
  //   { date: string,  reviewed: number | null,  retention: number | null }
  //   - date: human-readable label ("Today", "Friday", "Wednesday")
  //   - reviewed: count of cards reviewed that day, null = in-progress today
  //   - retention: 0..1 retention rate; null = no reviews that day (rest day)
  //
  // Path A — derive from /analytics/heatmap (no new route needed):
  //   useHeatmapData() already returns ApiList<ApiHeatmapDay>. If
  //   ApiHeatmapDay includes reviewed_count + retention per day, the web
  //   client can slice the last 7 days here and reformat into ActivityRow.
  //   Requires confirming ApiHeatmapDay's shape includes both fields; if it
  //   only has retention (heatmap-style), reviewed_count would still need
  //   to come from another endpoint or a heatmap extension.
  //
  // Path B — new bundled route (cleaner for the dashboard):
  //   GET /api/v1/analytics/recent?days=7
  //     → { items: Array<{ date, reviewed, retention }>, ... }
  //   Sorted by date descending (Today first). Returns rest days with
  //   reviewed=0 and retention=null. Today returns reviewed=null when
  //   the session is still in progress (no commit yet).
  //
  // SQL sketch (Path B):
  //   WITH days AS (
  //     SELECT generate_series(NOW()::date - INTERVAL '6 days', NOW()::date,
  //                            '1 day') AS day
  //   ) SELECT d.day, COALESCE(SUM(rl.reviewed), 0) AS reviewed,
  //                   AVG(rl.retention) AS retention
  //       FROM days d LEFT JOIN review_logs rl
  //         ON rl.user_id = $1 AND rl.reviewed_at::date = d.day
  //      GROUP BY d.day ORDER BY d.day DESC
  //
  // Web side: add `useRecentActivity()` hook in apps/web/lib/api/analytics.ts
  // with a 60s staleTime and invalidation on useSubmitReview onSettled.
  //
  // Until either path lands, Recent renders the editorial empty state:
  //   "No reviews logged yet. Today is a quiet page."
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
  // TODO: there is currently NO /api/v1/tomo/* route family at all. This is
  // the largest open piece of work for the dashboard — Tomo is the brand's
  // AI-companion voice, and the letterhead card is its primary surface.
  //
  // The card has TWO content variants the API needs to support:
  //
  //   1. INSIGHT (paid tier) — personalized daily prose written by gpt-5.4
  //      nano about the user's recent struggles. Example body:
  //        "You've slowed on negative-form verbs this week. Here's one to
  //         remember: 行かない (ikanai), 'won't go.'"
  //
  //   2. IDIOM (free tier + paid fallback) — a curated daily Japanese phrase
  //      with reading + meaning. Example:
  //        word:    "猿も木から落ちる"
  //        reading: "さるも きから おちる"
  //        meaning: "Even monkeys fall from trees…"
  //
  // ── Recommended route shape ────────────────────────────────────────────
  //
  //   GET /api/v1/tomo/note
  //     → { variant: 'insight' | 'idiom', date: string, ...payload }
  //
  //   When variant === 'insight':
  //     { variant: 'insight', date, body: { html: string } }
  //     `body.html` is sanitized prose with <span lang="ja"> markup for
  //     Japanese inserts. The web client renders it into the InsightBody
  //     paragraph (currently expects React.ReactNode; we'd switch to a
  //     dangerouslySetInnerHTML or a safe parser).
  //
  //   When variant === 'idiom':
  //     { variant: 'idiom', date, word, reading, meaning }
  //     Maps directly to the existing DailyIdiom type in note-from-tomo.tsx.
  //
  //   Server picks the variant based on user.tier (from profile):
  //     - free tier → always 'idiom'
  //     - paid tier → 'insight' on success, falls back to 'idiom' if
  //       OpenAI is rate-limited / out of quota / errors out
  //
  // ── Implementation notes for the insight branch ────────────────────────
  //
  //   - Use the existing OpenAI client (apps/api/src/services/ai.service.ts)
  //     with response_format: { type: 'json_object' } per CLAUDE.md.
  //   - Prompt should reference the user's last 7 days of review_logs:
  //       * which layouts are slowing (group by layout_type)
  //       * which lapses are recent (lapse_count delta over the week)
  //       * which JLPT level they're working in (highest non-mastered level)
  //   - Cache per-user in Upstash Redis for 24h, keyed by user_id +
  //     YYYY-MM-DD. Saves OpenAI cost; refreshes naturally each calendar day.
  //   - Goes through aiRateLimitMiddleware AND aiDailyQuotaMiddleware.
  //   - Sanitize prompt input (strip user-controlled HTML before passing
  //     to the model; the model output is already JSON so XSS risk is on
  //     the rendering side).
  //
  // ── Implementation notes for the idiom branch ──────────────────────────
  //
  //   - No AI call. Static curated list. Suggested location:
  //       apps/api/src/data/idioms.json — array of ~365 entries:
  //         { word, reading, meaning, jlptHint?: 'N5'..'N1' }
  //   - Selection: hash-by-day (e.g., dayOfYear % idioms.length) so all
  //     users see the same idiom on the same calendar day. Stable + simple.
  //   - No caching needed since selection is deterministic; the route can
  //     compute the response from the JSON file in <1ms.
  //   - Free-tier idioms can later filter by user.jlptCurrentLevel for
  //     reading-difficulty matching, but v1 doesn't need that.
  //
  // ── Web side hook ──────────────────────────────────────────────────────
  //
  //   Add useTomoNote() in a new apps/web/lib/api/tomo.ts:
  //     export function useTomoNote(): UseQueryResult<ApiTomoNote, Error> {
  //       return useQuery({
  //         queryKey: queryKeys.tomo.note(),
  //         queryFn:  getTomoNoteAction,
  //         staleTime: 1000 * 60 * 60 * 4,  // 4h, since refresh is daily
  //       })
  //     }
  //   Add queryKeys.tomo.note() in queryKeys.ts.
  //   Add an action getTomoNoteAction in apps/web/lib/actions/tomo.actions.ts
  //   that hits the API client.
  //
  // ── Empty-state behavior (current) ─────────────────────────────────────
  //
  //   With no route wired, both `insight` and `idiom` props are absent.
  //   note-from-tomo.tsx renders:
  //     - the kanji watermark (decorative chrome)
  //     - the NOTE FROM TOMO header without a date
  //     - an italic placeholder line: "Tomo's note will appear here when
  //       configured."
  //     - the 朋 sign-off is suppressed (no body to sign off on)
  //   This is the v9 "graceful empty letterhead" state — looks intentional,
  //   not like a layout bug.
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
