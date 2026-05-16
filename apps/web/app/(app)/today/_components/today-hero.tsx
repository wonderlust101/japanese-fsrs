'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'
import { Logo } from '@/components/ui/Logo'
import { JlptPill, StatusPill, type JlptPillLevel } from '@/components/ui/Pill'
import { QuietLink } from '@/components/ui/QuietLink'
import { Skeleton } from '@/components/ui/Skeleton'

import {
  formatCompactCount,
  formatExactCount,
  safeNonNegativeInteger,
} from './today-format'

// File map:
//   Types → resting/starter decks → DashboardHero (entry) →
//   variant content (Due, CaughtUp, FirstTime, Loading, Error, Resume) →
//   shared layout (HeroLayout, HeroKicker, QueueFactChips, HeroPrimaryAction) →
//   deck stack visuals → loading/error visuals → normalizers → color tokens.

// ── Preparation lines ────────────────────────────────────────────────────────
// Teacher-voice frames shown on the Due hero. Date-seeded so a single day's
// sessions see the same line; varies across days.
const PREPARATION_LINES = [
  'Each card seen is one settled.',
  'Be honest with the ratings. The schedule does the rest.',
  'Recall is a muscle; this is the practice.',
  'The harder ones teach the most.',
  'Sit with each card. The work happens in the recall.',
  'Some cards will feel new again. That is allowed.',
  'One card, then the next. No race here.',
] as const

const DEFAULT_PREPARATION_LINE: string = PREPARATION_LINES[0]

// Deterministic pick from the line pool — pure so tests/previews can pass
// any seed.
function pickPreparationLine(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PREPARATION_LINES[hash % PREPARATION_LINES.length] ?? DEFAULT_PREPARATION_LINE
}

// ── Types ────────────────────────────────────────────────────────────────────

export type HeroKind = 'due' | 'caught-up' | 'first-time' | 'loading' | 'error' | 'resume'

export interface ResumeContextSnapshot {
  remaining: number
}
export type HeroDeckTag =
  | { kind: 'level'; level: JlptPillLevel }
  | { kind: 'none' }

export interface HeroDeckPreview {
  id:           string
  title:        string
  subtitle:     string
  dueCount:     number
  newCount?:    number
  reviewCount?: number
  tag:          HeroDeckTag
}

export interface DueQueue {
  total:         number
  newCnt:        number
  review:        number
  backlog:       number
  statusNote?:   string | undefined
  decks:         HeroDeckPreview[]
  overflowDecks: number
}

export type DashboardHeroVariant =
  | { kind: 'due'; queue: DueQueue }
  | { kind: 'caught-up' }
  | { kind: 'first-time' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'resume'; context: ResumeContextSnapshot }

interface DashboardHeroProps {
  variant: DashboardHeroVariant
}

// ── Placeholder decks ────────────────────────────────────────────────────────

const RESTING_DECKS: HeroDeckPreview[] = [
  {
    id:       'resting-review',
    title:    'Review deck',
    subtitle: 'Nothing is due right now',
    dueCount: 0,
    tag:      { kind: 'none' },
  },
  {
    id:       'resting-schedule',
    title:    'Next review',
    subtitle: 'Cards return at the right time',
    dueCount: 0,
    tag:      { kind: 'none' },
  },
]

const STARTER_DECKS: HeroDeckPreview[] = [
  {
    id:       'starter-n5',
    title:    'N5 vocabulary',
    subtitle: 'First daily practice deck',
    dueCount: 42,
    tag:      { kind: 'level', level: 'N5' },
  },
  {
    id:       'starter-kanji',
    title:    'Joyo kanji',
    subtitle: 'Build recognition slowly',
    dueCount: 28,
    tag:      { kind: 'level', level: 'N5' },
  },
  {
    id:       'starter-grammar',
    title:    'Grammar patterns',
    subtitle: 'Short forms and examples',
    dueCount: 18,
    tag:      { kind: 'level', level: 'N5' },
  },
]

// ── Entry component ──────────────────────────────────────────────────────────

export function DashboardHero({ variant }: DashboardHeroProps): React.JSX.Element {
  const isError = variant.kind === 'error'

  return (
    <section
      aria-label="Today's practice"
      aria-busy={variant.kind === 'loading' ? true : undefined}
      className={[
        'relative overflow-hidden rounded-[2px]',
        isError
          ? 'border border-error/25 bg-warm-paper-base'
          : 'border border-soft-hairline bg-warm-paper-base',
        'px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'absolute inset-x-0 top-0 z-20 h-[2px]',
          isError ? 'bg-error' : 'bg-inari-vermillion',
        ].join(' ')}
      />

      <div className="relative z-10">
        {variant.kind === 'due'        && <DueContent queue={variant.queue} />}
        {variant.kind === 'caught-up'  && <CaughtUpContent />}
        {variant.kind === 'first-time' && <FirstTimeContent />}
        {variant.kind === 'loading'    && <LoadingContent />}
        {variant.kind === 'error'      && <ErrorContent />}
        {variant.kind === 'resume'     && <ResumeContent context={variant.context} />}
      </div>
    </section>
  )
}

// ── Variant: Due ─────────────────────────────────────────────────────────────

function DueContent({ queue }: { queue: DueQueue }): React.JSX.Element {
  const safeQueue = normalizeDueQueue(queue)
  const cardWord = safeQueue.total === 1 ? 'card' : 'cards'

  // SSR uses the stable default; client hydrates the date-seeded pick.
  const [preparationLine, setPreparationLine] = useState<string>(DEFAULT_PREPARATION_LINE)
  useEffect(() => {
    const dateKey = new Date().toISOString().slice(0, 10)
    setPreparationLine(pickPreparationLine(dateKey))
  }, [])

  return (
    <HeroLayout
      visual={
        <DeckStack
          decks={safeQueue.decks}
          overflowDecks={safeQueue.overflowDecks}
          emptyLabel="Queue details unavailable"
          emptyDescription="Reviews can still start from the total count."
        />
      }
    >
      <HeroKicker kanji="今" label="Today's plan" />

      <h2
        id="hero-headline"
        className="mt-5 break-words font-display text-[2.5rem] sm:text-[3.15rem] lg:text-[3.75rem] leading-[0.98] text-sumi-ink"
      >
        {formatExactCount(safeQueue.total)} {cardWord} due
      </h2>

      <p className="mt-4 max-w-[58ch] break-words text-base leading-relaxed text-faded-sumi">
        {preparationLine}
      </p>

      {safeQueue.statusNote !== undefined && (
        <p className="mt-3 break-words font-mono text-xs uppercase tracking-[0.12em] text-aizome-indigo">
          {safeQueue.statusNote}
        </p>
      )}

      <QueueFactChips
        newCount={safeQueue.newCnt}
        reviewCount={safeQueue.review}
        backlogCount={safeQueue.backlog}
      />

      <HeroPrimaryAction href="/review/session">Start reviews</HeroPrimaryAction>
      <p className="mt-3">
        <QuietLink href="/review/setup" tone="sumi">
          Customize this session
        </QuietLink>
      </p>
    </HeroLayout>
  )
}

// ── Variant: CaughtUp ────────────────────────────────────────────────────────

function CaughtUpContent(): React.JSX.Element {
  return (
    <HeroLayout visual={<DeckStack decks={RESTING_DECKS} overflowDecks={0} resting />}>
      <HeroKicker kanji="済" label="All clear" />

      <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Logo size={80} showWordmark={false} />
        <h2
          id="hero-headline"
          className="break-words font-display text-[2.35rem] sm:text-[3rem] lg:text-[3.55rem] leading-[1] text-sumi-ink"
        >
          Caught up.
          <span className="block text-faded-sumi font-normal">Enjoy your morning.</span>
        </h2>
      </div>

      <p className="mt-5 max-w-[54ch] break-words text-base text-faded-sumi leading-relaxed">
        The desk is clear. Cards return when they are close to fading.
      </p>

      <QueueFactChips newCount={0} reviewCount={0} backlogCount={0} quiet />

      <HeroPrimaryAction href="/review/setup?mode=ahead" variant="secondary" shortcutHint={false}>Study ahead</HeroPrimaryAction>
    </HeroLayout>
  )
}

// ── Variant: FirstTime ───────────────────────────────────────────────────────

function FirstTimeContent(): React.JSX.Element {
  return (
    <HeroLayout visual={<DeckStack decks={STARTER_DECKS} overflowDecks={0} />}>
      <HeroKicker kanji="初" label="First practice" />

      <h2
        id="hero-headline"
        className="mt-5 break-words font-display text-[2.25rem] sm:text-[2.85rem] lg:text-[3.35rem] leading-[1.02] text-sumi-ink"
      >
        Choose a deck to begin.
      </h2>

      <p className="mt-5 max-w-[56ch] break-words text-base text-faded-sumi leading-relaxed">
        Start with JLPT vocabulary, Joyo kanji, or grammar patterns. Once you add a deck, your daily review route starts here.
      </p>

      <QueueFactChips newCount={1} reviewCount={0} backlogCount={0} />

      <HeroPrimaryAction href="/decks" shortcutHint={false}>Browse decks</HeroPrimaryAction>
    </HeroLayout>
  )
}

// ── Variant: Loading ─────────────────────────────────────────────────────────

function LoadingContent(): React.JSX.Element {
  return (
    <HeroLayout visual={<LoadingDeckStack />}>
      <div className="flex items-baseline gap-3">
        <Skeleton width={34} height={36} className="rounded-[2px]" />
        <Skeleton width={132} height={16} />
      </div>
      <hr aria-hidden="true" className="mt-3 border-0 border-t border-soft-hairline" />

      <Skeleton width="min(440px, 92%)" height={64} className="mt-6 rounded-[4px]" />
      <Skeleton width="min(560px, 100%)" height={20} className="mt-5 rounded-[4px]" />
      <Skeleton width="min(460px, 86%)" height={20} className="mt-2 rounded-[4px]" />

      <div className="mt-6 flex items-stretch">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={[
              'flex flex-col gap-y-1.5',
              i === 0 ? 'pr-5' : 'border-l border-soft-hairline px-5',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <Skeleton width={2} height={20} className="sm:!h-6 lg:!h-7" />
              <Skeleton width={32} height={20} className="rounded-[2px] sm:!h-6 lg:!h-7" />
            </div>
            <Skeleton width={48} height={11} className="rounded-[1px]" />
          </div>
        ))}
      </div>

      <Skeleton width={220} height={56} className="mt-8 rounded-[2px]" />
    </HeroLayout>
  )
}

// ── Variant: Resume ──────────────────────────────────────────────────────────

function ResumeContent({ context }: { context: ResumeContextSnapshot }): React.JSX.Element {
  const remaining = safeNonNegativeInteger(context.remaining)
  const cardWord = remaining === 1 ? 'card' : 'cards'

  return (
    <HeroLayout
      visual={
        <DeckStack
          decks={RESTING_DECKS}
          overflowDecks={0}
          resting
          emptyLabel="Session paused"
          emptyDescription="Pick up where you left off."
        />
      }
    >
      <HeroKicker kanji="続" label="Resume practice" />

      <h2
        id="hero-headline"
        className="mt-5 break-words font-display text-[2.35rem] sm:text-[3rem] lg:text-[3.55rem] leading-[1] text-sumi-ink"
      >
        {formatExactCount(remaining)} {cardWord} left
        <span className="block font-normal text-faded-sumi">in your last session.</span>
      </h2>

      <HeroPrimaryAction href="/review/session">Resume review</HeroPrimaryAction>

      <div className="mt-3">
        <QuietLink href="/review/setup" tone="sumi">
          Start a new session instead
        </QuietLink>
      </div>
    </HeroLayout>
  )
}

// ── Variant: Error ───────────────────────────────────────────────────────────

function ErrorContent(): React.JSX.Element {
  return (
    <HeroLayout visual={<ErrorQueueVisual />}>
      <HeroKicker kanji="断" label="Connection interrupted" tone="error" />

      <div className="mt-5">
        <StatusPill status="danger" label="Error" size="md" />
      </div>
      <h2
        id="hero-headline"
        className="mt-4 break-words font-display text-[2.15rem] sm:text-[2.65rem] lg:text-[3.05rem] leading-[1.05] text-error-deep"
      >
        Queue did not load.
      </h2>

      <p className="mt-5 max-w-[54ch] break-words text-base text-faded-sumi leading-relaxed">
        The dashboard could not reach today's review queue. Your decks are unchanged; refresh when your connection is back.
      </p>

      <div className="mt-8 flex flex-col items-stretch gap-4 sm:items-start">
        <Link
          href="/today?retry=now"
          className={[
            'inline-flex min-h-14 w-full max-w-full items-center justify-center gap-2.5 rounded-[2px] px-6 py-3',
            'sm:w-auto sm:min-w-[min(240px,100%)] sm:px-8',
            'bg-error text-base font-medium text-warm-paper-raised',
            'today-motion-transform',
            'hover:-translate-y-0.5 hover:bg-error-deep active:translate-y-0 active:scale-[0.98]',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-error-deep',
          ].join(' ')}
        >
          Refresh page
          <ArrowGlyph direction="right" />
        </Link>
      </div>
    </HeroLayout>
  )
}

// ── Shared layout: HeroLayout, HeroKicker, QueueFactChips, HeroPrimaryAction ─

function HeroLayout({
  visual,
  children,
}: {
  visual:   React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-center">
      <div
        className="order-1 min-w-0 px-1 py-2 sm:px-2 lg:py-4 xl:order-none xl:col-start-1 xl:row-start-1"      >
        {children}
      </div>

      <div
        aria-hidden="true"
        className={[
          'order-2 relative hidden items-center justify-center overflow-visible',
          'sm:flex sm:min-h-[320px] sm:py-4 lg:min-h-[350px]',
          'xl:order-none xl:col-start-2 xl:row-start-1',
        ].join(' ')}      >
        {visual}
      </div>
    </div>
  )
}

function HeroKicker({
  kanji,
  label,
  tone = 'default',
}: {
  kanji: string
  label: string
  tone?: 'default' | 'error'
}): React.JSX.Element {
  const isError = tone === 'error'

  return (
    <header>
      <p className="flex items-baseline gap-3.5">
        <span
          lang="ja"
          aria-hidden="true"
          className={[
            'select-none font-display text-2xl leading-none',
            isError ? 'text-error' : 'text-inari-vermillion',
          ].join(' ')}
        >
          {kanji}
        </span>
        <span
          className={[
            'font-mono text-sm font-medium uppercase tracking-normal',
            isError ? 'text-error-deep/85' : 'text-sumi-ink/80',
          ].join(' ')}
        >
          {label}
        </span>
      </p>
      <hr
        aria-hidden="true"
        className={[
          'mt-3.5 border-0 border-t',
          isError ? 'border-error/25' : 'border-soft-hairline',
        ].join(' ')}
      />
    </header>
  )
}

function QueueFactChips({
  newCount,
  reviewCount,
  backlogCount,
  quiet = false,
}: {
  newCount:      number
  reviewCount:   number
  backlogCount:  number
  quiet?:        boolean
}): React.JSX.Element {
  const safeNewCount = safeNonNegativeInteger(newCount)
  const safeReviewCount = safeNonNegativeInteger(reviewCount)
  const safeBacklogCount = safeNonNegativeInteger(backlogCount)

  const facts: {
    key:    'new' | 'review' | 'backlog'
    count:  number
    label:  string
    tone:   'new' | 'review' | 'backlog' | 'neutral'
    aria:   string
  }[] = [
    {
      key:   'new',
      count: safeNewCount,
      label: 'new',
      tone:  safeNewCount > 0 ? 'new' : 'neutral',
      aria:  `${formatCompactCount(safeNewCount)} new ${safeNewCount === 1 ? 'card' : 'cards'}`,
    },
    {
      key:   'review',
      count: safeReviewCount,
      label: 'review',
      tone:  safeReviewCount > 0 ? 'review' : 'neutral',
      aria:  `${formatCompactCount(safeReviewCount)} review ${safeReviewCount === 1 ? 'card' : 'cards'}`,
    },
    ...(safeBacklogCount > 0
      ? [{
          key:   'backlog' as const,
          count: safeBacklogCount,
          label: 'overdue',
          tone:  'backlog' as const,
          aria:  `${formatCompactCount(safeBacklogCount)} overdue ${safeBacklogCount === 1 ? 'card' : 'cards'}`,
        }]
      : []),
  ]

  return (
    <dl
      aria-label="Review queue mix"
      className={[
        // today-fade-in smooths the hand-off from the loading skeleton
        // (same layout, opacity 1) to the live strip mount. Honors
        // prefers-reduced-motion via globals.css.
        'today-fade-in mt-6 flex flex-wrap items-stretch gap-y-3 sm:flex-nowrap',
        quiet ? 'opacity-60' : '',
      ].join(' ')}
    >
      {facts.map((fact, i) => (
        <div
          key={fact.key}
          aria-label={fact.aria}
          className={[
            'flex min-w-0 flex-col gap-y-1.5',
            i === 0 ? 'pr-5' : 'border-l border-soft-hairline px-5',
            'first:border-l-0 first:pl-0',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={[
                // Mark height tracks the numeral's leading-none line-height
                // across breakpoints, so the colored tick reads as a
                // marginalia stroke flush with the count.
                'inline-block w-[3px] shrink-0 h-5 sm:h-6 lg:h-7',
                QUEUE_FACT_MARK_CLASSES[fact.tone],
              ].join(' ')}
            />
            <dd className="font-mono tabular-nums leading-none text-xl text-sumi-ink sm:text-2xl lg:text-[1.75rem]">
              {formatCompactCount(fact.count)}
            </dd>
          </span>
          <dt className="font-mono text-xs uppercase tracking-[0.06em] text-faded-sumi sm:tracking-[0.08em]">
            {fact.label}
          </dt>
        </div>
      ))}
    </dl>
  )
}

const QUEUE_FACT_MARK_CLASSES = {
  neutral: 'bg-soft-hairline',
  new:     'bg-queue-new-mark',
  review:  'bg-queue-review-mark',
  backlog: 'bg-error-deep',
} as const

function HeroPrimaryAction({
  href,
  variant = 'primary',
  children,
  shortcutHint = true,
}: {
  href:          string
  variant?:      'primary' | 'secondary'
  children:      React.ReactNode
  shortcutHint?: boolean
}): React.JSX.Element {
  return (
    <div className="mt-8 flex flex-col gap-y-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
      <Link
        href={href}
        className={[
          'inline-flex min-h-14 w-full max-w-full items-center justify-center gap-2.5 rounded-[2px] px-6 py-3',
          'sm:w-auto sm:min-w-[min(280px,100%)] sm:px-10',
          'text-base font-semibold',
          'today-motion-transform',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
          variant === 'primary'
            ? 'today-hero-primary-action bg-inari-vermillion-deep text-warm-paper-raised hover:-translate-y-0.5 hover:bg-inari-vermillion active:translate-y-0 active:scale-[0.98]'
            : 'border border-soft-hairline bg-warm-paper-raised text-sumi-ink hover:-translate-y-0.5 hover:border-faded-sumi hover:bg-cream-inset active:translate-y-0 active:scale-[0.98]',
        ].join(' ')}
      >
        {children}
        <ArrowGlyph direction="right" />
      </Link>
      {shortcutHint && (
        <span
          aria-hidden="true"
          className="hidden font-mono text-xs uppercase tracking-[0.12em] text-faded-sumi sm:inline-flex sm:items-center sm:gap-2"
        >
          or press
          <kbd className="inline-flex min-h-5 items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-1.5 font-mono text-xs text-sumi-ink/80">
            R
          </kbd>
        </span>
      )}
    </div>
  )
}

// ── Deck stack ───────────────────────────────────────────────────────────────

function DeckStack({
  decks,
  overflowDecks,
  resting = false,
  emptyLabel = 'No deck data',
  emptyDescription = 'Reviews can still start from the queue total.',
}: {
  decks:            HeroDeckPreview[]
  overflowDecks:    number
  resting?:         boolean
  emptyLabel?:      string
  emptyDescription?: string
}): React.JSX.Element {
  const visibleDecks = decks.slice(0, 3).map(normalizeHeroDeck)
  const safeOverflowDecks = safeNonNegativeInteger(overflowDecks)

  if (visibleDecks.length === 0) {
    return (
      <div className="today-hero-deck-stack relative z-10 flex h-[16.75rem] w-full max-w-[27.5rem] items-center justify-center" aria-hidden="true">
        <div className="today-hero-card-shell today-hero-card-single w-full max-w-[24.5rem]">
          <div className="today-hero-card-surface relative overflow-hidden rounded-[2px] border border-dashed border-soft-hairline bg-warm-paper-raised/70 p-5">
            <div className="mx-auto mb-4 flex h-16 max-w-[13rem] items-end justify-center gap-2 border-b border-soft-hairline/70" aria-hidden="true">
              <span className="block h-9 w-12 rotate-[-3deg] rounded-[1px] border border-soft-hairline bg-cream-inset" />
              <span className="block h-12 w-12 rotate-[2deg] rounded-[1px] border border-inari-vermillion/30 bg-inari-vermillion/10" />
              <span className="block h-8 w-12 rotate-[-1deg] rounded-[1px] border border-soft-hairline bg-warm-paper-base" />
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-faded-sumi">
              {emptyLabel}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-faded-sumi">
              {emptyDescription}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const visibleDeckCount = visibleDecks.length

  return (
    <div className="today-hero-deck-stack relative z-10 h-[17.25rem] w-full max-w-[28rem]" aria-hidden="true">
      {visibleDecks.map((deck, index) => (
        <DeckStackCard
          key={`${deck.id}-${index}`}
          deck={deck}
          index={index}
          visibleDeckCount={visibleDeckCount}
          resting={resting}
          overflowDecks={index === 0 ? safeOverflowDecks : 0}
        />
      ))}
    </div>
  )
}

const STACK_POSITIONS = [
  'z-40 left-1/2 top-[98px] -translate-x-1/2 rotate-[-0.8deg]',
  'z-30 left-[55%] top-[64px] -translate-x-1/2 rotate-[1.6deg]',
  'z-20 left-[47%] top-[38px] -translate-x-1/2 rotate-[-2deg]',
] as const
const TWO_DECK_POSITIONS = [
  'z-40 left-[47%] top-1/2 -translate-x-1/2 -translate-y-[30%] rotate-[-0.8deg]',
  'z-30 left-[56%] top-1/2 -translate-x-1/2 -translate-y-[52%] rotate-[1.6deg]',
] as const
const SINGLE_DECK_POSITION = 'z-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-0'

function DeckStackCard({
  deck,
  index,
  visibleDeckCount,
  resting,
  overflowDecks,
}: {
  deck:             HeroDeckPreview
  index:            number
  visibleDeckCount: number
  resting:          boolean
  overflowDecks:    number
}): React.JSX.Element {
  const countLabel = deck.dueCount === 0
    ? (resting ? 'settled' : 'no due cards')
    : `${formatCompactCount(deck.dueCount)} due`

  return (
    <article
      className={[
        `today-hero-card-shell today-hero-card-${index} absolute w-[min(84%,22rem)]`,
        deckPositionClass(index, visibleDeckCount),
      ].join(' ')}
    >
      <div
        className={[
          'today-hero-card-surface relative overflow-hidden rounded-[2px]',
          'border border-soft-hairline/85 bg-warm-paper-raised p-4',
        ].join(' ')}
        style={{ borderTopColor: markColorForTag(deck.tag) }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-sumi-ink/60">
            Deck
          </span>
          <HeroDeckTagPill tag={deck.tag} />
        </div>

        <h3 className="mt-4 truncate text-base font-semibold text-sumi-ink">
          {deck.title}
        </h3>
        <p className="mt-1 truncate text-sm text-faded-sumi">
          {deck.subtitle}
        </p>

        <div className="mt-5 flex items-end justify-between gap-4">
          <p className="font-mono text-sm tabular-nums text-sumi-ink">
            {countLabel}
          </p>
          {overflowDecks > 0 && (
            <p className="font-mono text-xs tabular-nums text-faded-sumi">
              +{formatCompactCount(overflowDecks)} more
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function deckPositionClass(index: number, visibleDeckCount: number): string {
  if (visibleDeckCount === 1) {
    return SINGLE_DECK_POSITION
  }

  if (visibleDeckCount === 2) {
    return TWO_DECK_POSITIONS[index] ?? TWO_DECK_POSITIONS[0]
  }

  return STACK_POSITIONS[index] ?? STACK_POSITIONS[0]
}

function HeroDeckTagPill({ tag }: { tag: HeroDeckTag }): React.JSX.Element {
  if (tag.kind === 'level') {
    return <JlptPill level={tag.level} size="sm" />
  }

  return <span className="h-5" aria-hidden="true" />
}

// ── Loading and error visuals ────────────────────────────────────────────────

function LoadingDeckStack(): React.JSX.Element {
  return (
    <div className="today-hero-deck-stack relative z-10 h-[17.25rem] w-full max-w-[28rem]" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={[
            `today-hero-card-shell today-hero-card-${index} absolute w-[min(84%,22rem)]`,
            STACK_POSITIONS[index] ?? STACK_POSITIONS[0],
          ].join(' ')}
        >
          <div className="today-hero-card-surface relative overflow-hidden rounded-[2px] border border-soft-hairline/80 border-t-inari-vermillion/50 bg-warm-paper-raised p-4">
            <div className="flex justify-between">
              <Skeleton width={56} height={10} />
              <Skeleton width={42} height={16} className="rounded-full" />
            </div>
            <Skeleton width="78%" height={20} className="mt-5" />
            <Skeleton width="56%" height={14} className="mt-3" />
            <Skeleton width="36%" height={14} className="mt-6" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorQueueVisual(): React.JSX.Element {
  const cards = [
    { label: 'Queue', detail: 'No response', position: STACK_POSITIONS[2] },
    { label: 'Schedule', detail: 'Retry needed', position: STACK_POSITIONS[1] },
    { label: 'Reviews', detail: 'Paused', position: STACK_POSITIONS[0] },
  ]

  return (
    <div className="today-hero-deck-stack relative z-10 h-[17.25rem] w-full max-w-[28rem]" aria-hidden="true">
      <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-1/2 h-px bg-error/25" />
      <span aria-hidden="true" className="absolute left-[47%] top-[43%] h-14 w-px rotate-12 bg-error/40" />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-[44%] z-40 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2px] border border-error/40 bg-error-tint font-mono text-base font-semibold text-error-deep"
      >
        <span        >
          !
        </span>
      </span>

      {cards.map((card, index) => (
        <article
          key={card.label}
          className={[
            `today-hero-card-shell today-hero-card-${index} absolute w-[min(84%,22rem)]`,
            card.position,
          ].join(' ')}
        >
          <div className="today-hero-card-surface relative overflow-hidden rounded-[2px] border border-error/24 border-t-error/70 bg-warm-paper-raised p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-error-deep/70">
                {card.label}
              </span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-error/25 bg-error-tint px-1.5 font-mono text-[0.625rem] font-semibold text-error-deep">
                {index === 2 ? '!' : '...'}
              </span>
            </div>

            <p className="mt-4 text-base font-semibold text-error-deep">
              {card.detail}
            </p>
            <div className="mt-4 space-y-2" aria-hidden="true">
              <span className="block h-1.5 w-10/12 rounded-[1px] bg-error/20" />
              <span className="block h-1.5 w-7/12 rounded-[1px] bg-error/15" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeDueQueue(queue: DueQueue): DueQueue {
  const newCnt = safeNonNegativeInteger(queue.newCnt)
  const review = safeNonNegativeInteger(queue.review)
  const backlog = safeNonNegativeInteger(queue.backlog)
  const explicitTotal = newCnt + review + backlog
  const total = Math.max(safeNonNegativeInteger(queue.total), explicitTotal)
  const statusNote = queue.statusNote?.trim()

  return {
    ...queue,
    total,
    newCnt,
    review,
    backlog,
    statusNote:    statusNote !== undefined && statusNote.length > 0 ? statusNote : undefined,
    decks:         queue.decks,
    overflowDecks: safeNonNegativeInteger(queue.overflowDecks),
  }
}

function normalizeHeroDeck(deck: HeroDeckPreview): HeroDeckPreview {
  const {
    dueCount,
    id,
    newCount,
    reviewCount,
    subtitle,
    title,
    ...rest
  } = deck

  return {
    ...rest,
    id:       id.trim(),
    title:    title.trim() || 'Untitled deck',
    subtitle: subtitle.trim() || 'Review queue',
    dueCount: safeNonNegativeInteger(dueCount),
    ...(newCount === undefined ? {} : { newCount: safeNonNegativeInteger(newCount) }),
    ...(reviewCount === undefined ? {} : { reviewCount: safeNonNegativeInteger(reviewCount) }),
  }
}

// ── Color tokens ─────────────────────────────────────────────────────────────

const LEVEL_MARK_COLORS: Record<JlptPillLevel, string> = {
  N5:          'var(--color-deck-n5-mark)',
  N4:          'var(--color-deck-n4-mark)',
  N3:          'var(--color-deck-n3-mark)',
  N2:          'var(--color-deck-n2-mark)',
  N1:          'var(--color-deck-n1-mark)',
  beyond:      'var(--color-deck-beyond-mark)',
  beyond_jlpt: 'var(--color-deck-beyond-mark)',
  kana:        'var(--color-deck-n4-mark)',
}

function markColorForTag(tag: HeroDeckTag): string {
  return tag.kind === 'level'
    ? LEVEL_MARK_COLORS[tag.level]
    : 'var(--color-soft-hairline)'
}
