'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ApiForecastDay } from '@fsrs-japanese/shared-types'

import {
  addDaysToDateKey,
  dateNumberFromDateKey,
  dayLabelForDateKey,
  calendarDateKeyFromApiDate,
} from './today-calendar'
import {
  formatCompactCount,
  safeNonNegativeInteger,
} from './today-format'
import { SkeletonBlock } from './section-primitives'

// ── Layout constants ─────────────────────────────────────────────────────────
// 7-day horizon (today + next 6). On narrow screens the last 2 days are
// visually hidden — the chart fills 168px tall.
const HORIZON_DAYS        = 7
const MOBILE_VISIBLE_DAYS = 5
const CHART_HEIGHT        = 168

// ── Segment tokens ───────────────────────────────────────────────────────────
// Same three segments, sorted differently for stacking vs legend display.

export type WeekRhythmState = 'default' | 'loading' | 'error'

type SegmentKey = 'backlog' | 'review' | 'new'

interface Segment {
  key:   SegmentKey
  label: string
  color: string
}

const SEGMENT_BY_KEY = {
  backlog: { key: 'backlog', label: 'Overdue', color: 'var(--color-queue-backlog-mark)' },
  review:  { key: 'review',  label: 'Due',     color: 'var(--color-queue-review-mark)'  },
  new:     { key: 'new',     label: 'New',     color: 'var(--color-queue-new-mark)'     },
} satisfies Record<SegmentKey, Segment>

// The stack uses flex-col-reverse, so the first array entry renders at the
// top: backlog (top) → review (middle) → new (bottom).
const STACK_SEGMENTS: Segment[] = [
  SEGMENT_BY_KEY.backlog,
  SEGMENT_BY_KEY.review,
  SEGMENT_BY_KEY.new,
]

const LEGEND_SEGMENTS: Segment[] = [
  SEGMENT_BY_KEY.new,
  SEGMENT_BY_KEY.review,
  SEGMENT_BY_KEY.backlog,
]

interface WeekRhythmStripProps {
  state:    WeekRhythmState
  todayKey: string
  apiDays:  ReadonlyArray<ApiForecastDay>
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RhythmDay {
  key:     string
  label:   string
  dateNum: number
  total:   number
  newCnt:  number
  review:  number
  backlog: number
  isToday: boolean
}

// ── Day computation ──────────────────────────────────────────────────────────
// Trim the 14-day API payload down to the 7-day horizon starting at todayKey.

function buildDays(
  apiDays:  ReadonlyArray<ApiForecastDay>,
  todayKey: string,
): RhythmDay[] {
  const byKey = new Map<string, ApiForecastDay>()
  for (const day of apiDays) {
    byKey.set(calendarDateKeyFromApiDate(day.date), day)
  }

  const out: RhythmDay[] = []
  for (let i = 0; i < HORIZON_DAYS; i += 1) {
    const key     = addDaysToDateKey(todayKey, i)
    const day     = byKey.get(key)
    const newCnt  = safeNonNegativeInteger(day?.newCount)
    const review  = safeNonNegativeInteger(day?.reviewCount)
    const backlog = safeNonNegativeInteger(day?.backlogCount)
    out.push({
      key,
      label:   dayLabelForDateKey(key),
      dateNum: dateNumberFromDateKey(key),
      total:   newCnt + review + backlog,
      newCnt,
      review,
      backlog,
      isToday: i === 0,
    })
  }
  return out
}

// ── Container chrome ─────────────────────────────────────────────────────────

const CONTAINER_CHROME = [
  'relative overflow-hidden rounded-[2px]',
  'border border-soft-hairline bg-warm-paper-raised',
  'px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7',
].join(' ')

// ── Public component ─────────────────────────────────────────────────────────

export function WeekRhythmStrip({
  state,
  todayKey,
  apiDays,
}: WeekRhythmStripProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-label="The week ahead" className={CONTAINER_CHROME}>
        <TopStripe />
        <Header />
        <SkeletonChart />
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-label="The week ahead" className={CONTAINER_CHROME}>
        <TopStripe />
        <Header />
        <p className="mt-4 font-mono text-xs text-faded-sumi">
          Could not load the next seven days. Refresh to retry.
        </p>
      </section>
    )
  }

  // Memoize the per-day derivation chain so the 14-day projection only runs
  // when its inputs actually change (the forecast payload or today's date key).
  // Without this, every parent re-render walks the loop, even though the data
  // is identical.
  const days     = useMemo(() => buildDays(apiDays, todayKey), [apiDays, todayKey])
  const scaleMax = useMemo(() => roundUpToNice(peakCountForDays(days)), [days])
  const isEmptyForecast = days.every((day) => day.total === 0)
  const [glossaryOpen, setGlossaryOpen] = useState(false)

  if (isEmptyForecast) {
    return (
      <section aria-label="The week ahead" className={CONTAINER_CHROME}>
        <TopStripe />
        <Header />
        <EmptyForecast />
      </section>
    )
  }

  return (
    <section aria-label="The week ahead" className={CONTAINER_CHROME}>
      <TopStripe />
      <Header />

      <div className="mt-5">
        <ol
          className="flex items-end gap-1.5 sm:gap-2 lg:gap-3"
          style={{ height: `${CHART_HEIGHT}px` }}
          aria-label="Review forecast for the week ahead"
        >
          {days.map((day, i) => (
            <BarColumn
              key={day.key}
              day={day}
              dayIndex={i}
              scaleMax={scaleMax}
              mobileHidden={i >= MOBILE_VISIBLE_DAYS}
            />
          ))}
        </ol>

        <hr aria-hidden="true" className="border-0 border-t border-soft-hairline" />

        <ol aria-hidden="true" className="mt-3 flex items-start gap-1.5 sm:gap-2 lg:gap-3">
          {days.map((day, i) => (
            <li
              key={day.key}
              className={[
                'flex-1 text-center',
                day.isToday ? 'text-sumi-ink font-semibold' : 'text-faded-sumi/60',
                i >= MOBILE_VISIBLE_DAYS ? 'hidden sm:block' : '',
              ].join(' ')}
            >
              <div className="font-mono uppercase tracking-[0.06em] tabular-nums text-xs">
                {day.isToday ? 'Today' : day.label}
              </div>
              <div className="mt-0.5 font-mono tabular-nums text-[0.625rem] text-faded-sumi/60">
                {day.isToday ? <span className="text-sumi-ink">{day.dateNum}</span> : day.dateNum}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 flex flex-col gap-y-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-0">
        <Legend />
        <GlossaryToggle open={glossaryOpen} onToggle={() => setGlossaryOpen((o) => !o)} />
      </div>

      {glossaryOpen && <Glossary />}
    </section>
  )
}

// ── Chart components ─────────────────────────────────────────────────────────

interface BarColumnProps {
  day:           RhythmDay
  dayIndex:      number
  scaleMax:      number
  mobileHidden?: boolean
}

function BarColumn({ day, dayIndex, scaleMax, mobileHidden = false }: BarColumnProps): React.JSX.Element {
  const ratio = scaleMax > 0 ? day.total / scaleMax : 0
  const barHeight = day.total === 0
    ? 1
    : Math.max(2, Math.round(ratio * (CHART_HEIGHT)))

  return (
    <li
      className={[
        'h-full min-w-0 flex-1 flex-col items-center justify-end',
        mobileHidden ? 'hidden sm:flex' : 'flex',
      ].join(' ')}
      aria-label={`${day.isToday ? 'Today' : day.label} ${day.dateNum}: ${day.total} cards (${day.newCnt} new, ${day.review} review, ${day.backlog} overdue)`}
    >
      <span
        className={[
          'mb-1 max-w-full truncate font-mono tabular-nums leading-none',
          day.isToday
            ? 'text-xs font-semibold text-sumi-ink'
            : 'text-[0.625rem] text-faded-sumi/60',
        ].join(' ')}
      >
        {formatCompactCount(day.total)}
      </span>

      <StackedBar day={day} dayIndex={dayIndex} height={barHeight} />
    </li>
  )
}

interface StackedBarProps {
  day:      RhythmDay
  dayIndex: number
  height:   number
}

function StackedBar({ day, height }: StackedBarProps): React.JSX.Element {
  const visibleSegments = STACK_SEGMENTS
    .map((segment) => ({
      ...segment,
      value:
        segment.key === 'backlog' ? day.backlog :
        segment.key === 'review'  ? day.review  :
                                    day.newCnt,
    }))
    .filter((segment) => segment.value > 0)
  const animationKey = `${day.key}-${day.total}-${day.backlog}-${day.review}-${day.newCnt}`

  if (day.total === 0 || visibleSegments.length === 0) {
    return (
      <span
        key={`empty-${animationKey}`}
        aria-hidden="true"
        className="w-full max-w-[44px] origin-bottom rounded-t-[1px] bg-soft-hairline sm:max-w-[56px] lg:max-w-[72px]"        style={{ height: `${height}px` }}
      />
    )
  }

  return (
    <span
      key={animationKey}
      aria-hidden="true"
      className="flex w-full max-w-[44px] origin-bottom flex-col-reverse overflow-hidden rounded-t-[1px] bg-soft-hairline sm:max-w-[56px] lg:max-w-[72px]"      style={{ height: `${height}px` }}
    >
      {visibleSegments.map((segment, index) => (
        <span
          key={segment.key}
          className="min-h-0"
          style={{
            flexGrow:        segment.value,
            minHeight:       visibleSegments.length > 1 ? '2px' : undefined,
            backgroundColor: segment.color,
            boxShadow:       index > 0 ? 'inset 0 -1px 0 var(--color-warm-paper-raised)' : undefined,
          }}
        />
      ))}
    </span>
  )
}

function SkeletonChart(): React.JSX.Element {
  const heights = [46, 72, 34, 88, 58, 26, 64]
  return (
    <div className="mt-5">
      <div className="flex items-end gap-1.5 sm:gap-2 lg:gap-3" style={{ height: `${CHART_HEIGHT}px` }}>
        {heights.map((height, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center">
            <SkeletonBlock width="72%" height={height} className="rounded-t-[1px]" />
          </div>
        ))}
      </div>
      <hr aria-hidden="true" className="mt-0 border-0 border-t border-soft-hairline" />
      <div className="mt-3 flex items-start gap-1.5 sm:gap-2 lg:gap-3">
        {heights.map((_, i) => (
          <div key={i} className="flex-1 text-center">
            <SkeletonBlock width="60%" height={11} className="mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend(): React.JSX.Element {
  return (
    <ul aria-label="Bar segments" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {LEGEND_SEGMENTS.map((segment) => (
        <li key={segment.key} className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="block h-2 w-2 rounded-[1px]"
            style={{ backgroundColor: segment.color }}
          />
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi">
            {segment.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Chrome and copy ──────────────────────────────────────────────────────────

function TopStripe(): React.JSX.Element {
  return (
    <span aria-hidden="true" className="absolute inset-x-0 top-0 z-20 h-px bg-inari-vermillion/45" />
  )
}

function Header(): React.JSX.Element {
  // On phones the action stacks below the title so neither side has to
  // squeeze: the link's "See the next two weeks →" is too wide to share a
  // row with the title at 320px. From sm+ they sit on one baseline.
  return (
    <div className="flex flex-col gap-y-1 border-b border-soft-hairline pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4 sm:gap-y-0">
      <h2 className="flex items-baseline gap-2.5">
        <span lang="ja" aria-hidden="true" className="font-display text-xl text-inari-vermillion leading-none translate-y-[0.05em]">
          週
        </span>
        <span className="font-mono text-sm font-medium uppercase tracking-normal text-sumi-ink/80">
          The week ahead
        </span>
      </h2>
      <Link
        href="/insights/forecast"
        className={[
          '-ml-1 inline-flex min-h-9 w-fit items-center px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi',
          'sm:ml-0 sm:min-h-0 sm:px-0 sm:py-0',
          'today-motion-colors hover:text-inari-vermillion underline-offset-4 hover:underline',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-inari-vermillion/45',
        ].join(' ')}
      >
        See the next two weeks →
      </Link>
    </div>
  )
}

function EmptyForecast(): React.JSX.Element {
  return (
    <div className="mt-5 flex flex-col items-start gap-y-1.5 border-t border-soft-hairline pt-5">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi">
        Quiet week
      </p>
      <p className="max-w-[58ch] text-sm leading-relaxed text-faded-sumi">
        Nothing is scheduled for the next seven days. Cards return when they are close to fading.
      </p>
    </div>
  )
}

function GlossaryToggle({
  open,
  onToggle,
}: {
  open:     boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="week-rhythm-glossary"
      className={[
        '-ml-1 inline-flex min-h-9 w-fit items-center px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi',
        'sm:ml-0 sm:min-h-0 sm:px-0 sm:py-0',
        'today-motion-colors hover:text-inari-vermillion underline-offset-4 hover:underline',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-inari-vermillion/45',
      ].join(' ')}
    >
      {open ? 'Hide definitions' : 'What do these mean?'}
    </button>
  )
}

function Glossary(): React.JSX.Element {
  return (
    <dl
      id="week-rhythm-glossary"
      className="mt-4 grid gap-x-6 gap-y-3 border-t border-soft-hairline pt-4 sm:grid-cols-3"
    >
      <div>
        <dt
          className="font-mono text-xs uppercase tracking-[0.12em]"
          style={{ color: 'var(--color-queue-new-mark)' }}
        >
          New
        </dt>
        <dd className="mt-1 text-sm leading-relaxed text-faded-sumi">
          Not yet reviewed. The first rating starts their schedule.
        </dd>
      </div>
      <div>
        <dt
          className="font-mono text-xs uppercase tracking-[0.12em]"
          style={{ color: 'var(--color-queue-review-mark)' }}
        >
          Due
        </dt>
        <dd className="mt-1 text-sm leading-relaxed text-faded-sumi">
          Scheduled for today. Recall, then rate honestly.
        </dd>
      </div>
      <div>
        <dt
          className="font-mono text-xs uppercase tracking-[0.12em]"
          style={{ color: 'var(--color-queue-backlog-mark)' }}
        >
          Overdue
        </dt>
        <dd className="mt-1 text-sm leading-relaxed text-faded-sumi">
          Past due. The next interval will tighten.
        </dd>
      </div>
    </dl>
  )
}

// ── Scale helpers ─────────────────────────────────────────────────────────────

function peakCountForDays(days: ReadonlyArray<RhythmDay>): number {
  let peak = 0
  for (const day of days) {
    if (day.total > peak) peak = day.total
  }
  return peak
}

function roundUpToNice(value: number): number {
  if (value <= 0) return 1
  if (value <= 5)   return 5
  if (value <= 10)  return 10
  if (value <= 20)  return 20
  if (value <= 50)  return 50
  if (value <= 100) return 100
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  return Math.ceil(value / magnitude) * magnitude
}
