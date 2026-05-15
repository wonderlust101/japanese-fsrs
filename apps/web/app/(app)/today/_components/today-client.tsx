'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import {
  getEnglishWelcomeClause,
  getGreetingBucket,
  getJapaneseGreeting,
} from '@/lib/japanese-greeting'
import { useDecks } from '@/lib/api/decks'
import { useDueCards, useReviewForecast } from '@/lib/api/reviews'
import { useResumeContext } from '@/stores/useReviewSessionStore'

import { OfflineStatusBand } from './offline-status-band'
import {
  addDaysToDateKey,
  buildDashboardCalendarContext,
  normalizeDashboardTimeZone,
  type DashboardCalendarContext,
} from './today-calendar'
import { buildHeroQueueFromDueCards } from './today-due-queue'
import { TodayDevToolsDock } from './today-dev-tools-dock'
import {
  DashboardHero,
  type DashboardHeroVariant,
} from './today-hero'
import type { HeroDevControls } from './today-hero-dev-toolbar'
import type { ModuleDevControls } from './today-modules-dev-toolbar'
import { buildPreviewForecastDays, buildPreviewHeroVariant } from './today-preview-data'
import { WeekRhythmStrip, type WeekRhythmState } from './week-rhythm-strip'

// ── Constants ────────────────────────────────────────────────────────────────

const HERO_PREVIEW_ENABLED              = process.env.NODE_ENV !== 'production'
const DASHBOARD_DEV_TOOLS_TOGGLE_EVENT  = 'tomo:dashboard-dev-tools:toggle'
const CALENDAR_TICK_MS                  = 60_000

const DEFAULT_HERO_DEV_CONTROLS: HeroDevControls = {
  variant:  'due',
  queue:    'typical',
  decks:    'three',
  routeMix: 'balanced',
  flag:     'none',
}

const DEFAULT_MODULE_DEV_CONTROLS: ModuleDevControls = {
  weekState:   'default',
  weekPattern: 'typical',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TodayClientProps {
  dateLabel:      string
  dateTime:       string
  greetingName:   string | null
  greetingPrefix: string
  timeZone:       string
}

function calendarContextsEqual(
  current: DashboardCalendarContext,
  next:    DashboardCalendarContext,
): boolean {
  return current.dateLabel      === next.dateLabel
      && current.dateTime       === next.dateTime
      && current.greetingPrefix === next.greetingPrefix
      && current.todayKey       === next.todayKey
      && current.yesterdayKey   === next.yesterdayKey
      && current.timeZone       === next.timeZone
}

// ── Today client ─────────────────────────────────────────────────────────────

export function DashboardClient({
  dateLabel,
  dateTime,
  greetingName,
  greetingPrefix,
  timeZone,
}: TodayClientProps): React.JSX.Element {
  const router                              = useRouter()
  const [heroControls, setHeroControls]     = useState<HeroDevControls>(DEFAULT_HERO_DEV_CONTROLS)
  const [moduleControls, setModuleControls] = useState<ModuleDevControls>(DEFAULT_MODULE_DEV_CONTROLS)
  const [devToolsOpen, setDevToolsOpen]     = useState(false)
  const [calendar, setCalendar]             = useState<DashboardCalendarContext>(() => ({
    dateLabel,
    dateTime,
    greetingPrefix,
    todayKey:     dateTime,
    yesterdayKey: addDaysToDateKey(dateTime, -1),
    timeZone:     normalizeDashboardTimeZone(timeZone),
  }))
  const previewActive = HERO_PREVIEW_ENABLED && devToolsOpen

  // Tick the calendar context once a minute so date/greeting stay accurate
  // across midnight without a full page reload.
  useEffect(() => {
    function sync(): void {
      setCalendar((current) => {
        const next = buildDashboardCalendarContext(new Date(), timeZone)
        return calendarContextsEqual(current, next) ? current : next
      })
    }
    sync()
    const id = window.setInterval(sync, CALENDAR_TICK_MS)
    return () => window.clearInterval(id)
  }, [timeZone])

  useEffect(() => {
    if (!HERO_PREVIEW_ENABLED) return
    function toggle(): void { setDevToolsOpen((open) => !open) }
    window.addEventListener(DASHBOARD_DEV_TOOLS_TOGGLE_EVENT, toggle)
    return () => window.removeEventListener(DASHBOARD_DEV_TOOLS_TOGGLE_EVENT, toggle)
  }, [])

  useEffect(() => {
    if (!devToolsOpen) return
    function onEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setDevToolsOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [devToolsOpen])

  // ── Live data sources ──────────────────────────────────────────────────────
  const decksQuery    = useDecks()
  const dueQuery      = useDueCards()
  const forecastQuery = useReviewForecast()
  const resume        = useResumeContext()

  const deckById = useMemo(
    () => new Map((decksQuery.data?.items ?? []).map((d) => [d.id, d])),
    [decksQuery.data],
  )

  // Power-user fast path: `R`/`Enter` anywhere on Today starts a review.
  // Suppressed when a modifier is held or focus is inside a form control —
  // those cases own the key.
  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const key = event.key.toLowerCase()
      if (key !== 'r' && key !== 'enter') return

      const target = event.target as HTMLElement | null
      if (target !== null) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.isContentEditable) return
      }

      event.preventDefault()
      router.push(resume !== null ? '/review/session' : '/review/setup')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router, resume])

  // ── Hero variant ───────────────────────────────────────────────────────────
  // Resume takes precedence over every other variant per IA.
  const liveHeroVariant = useMemo<DashboardHeroVariant>(() => {
    if (resume !== null)                                  return { kind: 'resume', context: { remaining: resume.remaining } }
    if (dueQuery.isLoading || decksQuery.isLoading)       return { kind: 'loading' }
    if (dueQuery.isError)                                 return { kind: 'error' }

    const items = dueQuery.data?.items ?? []
    if (items.length === 0)                               return { kind: 'caught-up' }

    return {
      kind:  'due',
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
    resume,
  ])

  const previewHeroVariant = useMemo(() => buildPreviewHeroVariant(heroControls), [heroControls])
  const heroVariant = previewActive ? previewHeroVariant : liveHeroVariant

  // ── Week rhythm strip ──────────────────────────────────────────────────────
  const liveWeekRhythmState: WeekRhythmState = (() => {
    if (forecastQuery.isLoading) return 'loading'
    if (forecastQuery.isError)   return 'error'
    return 'default'
  })()
  const weekRhythmState = previewActive ? moduleControls.weekState : liveWeekRhythmState

  const previewWeekRhythmDays = useMemo(
    () => buildPreviewForecastDays(moduleControls.weekPattern, calendar.todayKey),
    [moduleControls.weekPattern, calendar.todayKey],
  )
  const weekRhythmDays = previewActive ? previewWeekRhythmDays : (forecastQuery.data?.items ?? [])

  return (
    <div className="relative isolate flex flex-1 flex-col">
      <PageBackdrop />

      <div className="relative z-10 grid flex-1 grid-cols-1 content-center gap-y-8 mx-auto w-full max-w-[1440px] px-6 pt-8 md:px-12 md:pt-10 lg:px-16 lg:pt-12">
        {previewActive && (
          <TodayDevToolsDock
            heroControls={heroControls}
            moduleControls={moduleControls}
            onHeroChange={setHeroControls}
            onModuleChange={setModuleControls}
            onClose={() => setDevToolsOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 gap-y-4">
          <GreetingHeader greetingName={greetingName} />
          <OfflineStatusBand />
          <DashboardHero variant={heroVariant} />
        </div>

        <div className="grid grid-cols-1 gap-y-4">
          <WeekRhythmStrip
            state={weekRhythmState}
            todayKey={calendar.todayKey}
            apiDays={weekRhythmDays}
          />
          <ExitLinksRow />
        </div>
      </div>
    </div>
  )
}

// ── Page backdrop ────────────────────────────────────────────────────────────

function PageBackdrop(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none sticky top-0 z-0 -mb-[100vh] h-screen overflow-hidden"
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 z-20 h-[2px] bg-inari-vermillion" />
      <Image
        src="/assets/dashboard/hero-garden-background.png"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="(min-width: 1024px) calc(100vw - 18rem), 100vw"
        className="object-cover opacity-[0.85] contrast-[1.15] brightness-[0.98]"
        style={{
          objectPosition:  '65% 50%',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 22%, black 78%, transparent 100%)',
          maskImage:       'linear-gradient(180deg, transparent 0%, black 22%, black 78%, transparent 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(180deg, var(--color-cool-paper-base) 0%, transparent 14%, transparent 86%, var(--color-cool-paper-base) 100%)',
            'linear-gradient(90deg, color-mix(in srgb, var(--color-cool-paper-base) 22%, transparent) 0%, transparent 50%, color-mix(in srgb, var(--color-cool-paper-base) 22%, transparent) 100%)',
            'linear-gradient(0deg, color-mix(in srgb, var(--color-inari-vermillion) 2%, transparent), color-mix(in srgb, var(--color-inari-vermillion) 2%, transparent))',
          ].join(', '),
        }}
      />
    </div>
  )
}

// ── Greeting header ──────────────────────────────────────────────────────────

function GreetingHeader({ greetingName }: { greetingName: string | null }): React.JSX.Element {
  // Japanese eyebrow and English second clause are derived from the browser
  // hour, so they're hydration-only. Reserve their vertical space ahead of
  // mount so the headline doesn't reflow when they fade in.
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => { setHour(new Date().getHours()) }, [])

  const japaneseGreeting = hour !== null ? getJapaneseGreeting(hour)                       : null
  const warmClause       = hour !== null ? getEnglishWelcomeClause(getGreetingBucket(hour)) : null
  const englishLead      = greetingName !== null ? `Welcome back, ${greetingName}.` : 'Welcome back.'

  return (
    <header className="grid gap-y-3">
      <p
        lang="ja"
        aria-hidden={japaneseGreeting === null}
        className={[
          'min-h-[1.6em] text-[1.0625rem] leading-relaxed text-faded-sumi',
          'transition-opacity duration-500 ease-out motion-reduce:transition-none',
          japaneseGreeting === null ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        {japaneseGreeting !== null ? `${japaneseGreeting}。` : '　'}
      </p>

      <h1
        id="today-greeting"
        className="max-w-[48rem] font-display text-[1.65rem] font-medium leading-[1.12] text-sumi-ink text-balance sm:text-[1.95rem] lg:text-[2.25rem]"
      >
        {englishLead}{' '}
        <span
          aria-hidden={warmClause === null}
          className={[
            'font-normal text-faded-sumi',
            'transition-opacity duration-500 ease-out motion-reduce:transition-none',
            warmClause === null ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          {warmClause ?? ' '}
        </span>
      </h1>
    </header>
  )
}

// ── Exit links (quiet typographic row to Insights) ───────────────────────────

const EXIT_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/insights/mistakes', label: 'Review weak spots' },
  { href: '/insights/progress', label: "See how you're trending" },
  { href: '/decks',             label: 'Manage decks' },
]

function ExitLinksRow(): React.JSX.Element {
  return (
    <nav aria-label="More on Tomo">
      <ul className="flex flex-col border-t border-soft-hairline sm:hidden">
        {EXIT_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={[
                'flex min-h-11 items-center justify-between gap-3 border-b border-soft-hairline px-1 py-2.5',
                'font-mono text-[0.75rem] uppercase tracking-[0.10em] text-sumi-ink/80',
                'today-motion-colors',
                'hover:text-inari-vermillion active:bg-cream-inset/60',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45',
              ].join(' ')}
            >
              <span>{link.label}</span>
              <span aria-hidden="true" className="font-mono text-base leading-none text-faded-sumi/70">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="hidden flex-wrap items-center gap-x-3 gap-y-1 sm:-ml-1 sm:flex">
        {EXIT_LINKS.map((link, index) => (
          <li key={link.href} className="flex items-center gap-x-3">
            {index > 0 && (
              <span aria-hidden="true" className="font-mono text-xs text-faded-sumi/45">
                ·
              </span>
            )}
            <Link
              href={link.href}
              className={[
                'inline-flex min-h-9 items-center px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi',
                'today-motion-colors hover:text-inari-vermillion underline-offset-4 hover:underline',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-inari-vermillion/45',
              ].join(' ')}
            >
              {link.label} →
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
