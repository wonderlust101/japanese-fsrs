'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'
import { Logo } from '@/components/ui/Logo'
import { JlptPill, StatusPill, type JlptPillLevel } from '@/components/ui/Pill'
import { EASE_OUT_EXPO } from '@/lib/motion'

import {
  formatCompactCount,
  formatExactCount,
  safeNonNegativeInteger,
} from './today-format'
import { SkeletonBlock } from './section-primitives'

export type HeroKind = 'due' | 'caught-up' | 'first-time' | 'loading' | 'error'
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

interface DashboardHeroProps {
  variant: DashboardHeroVariant
}

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

export function DashboardHero({ variant }: DashboardHeroProps): React.JSX.Element {
  const isError = variant.kind === 'error'

  return (
    <section
      aria-label="Today's practice"
      aria-busy={variant.kind === 'loading' ? true : undefined}
      className={[
        'relative overflow-hidden rounded-[2px]',
        isError
          ? 'border border-error/25 bg-error-tint/20'
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
      </div>
    </section>
  )
}

function DueContent({ queue }: { queue: DueQueue }): React.JSX.Element {
  const safeQueue = normalizeDueQueue(queue)
  const cardWord = safeQueue.total === 1 ? 'card' : 'cards'
  const deckWord = safeQueue.decks.length === 1 ? 'deck' : 'decks'
  const visibleDeckCount = safeQueue.decks.length
  const deckLine = visibleDeckCount > 0
    ? `${visibleDeckCount}${safeQueue.overflowDecks > 0 ? ` + ${safeQueue.overflowDecks}` : ''} ${deckWord} in today's stack`
    : 'Queue details are still settling'
  const overdueWord = safeQueue.backlog === 1 ? 'card' : 'cards'
  const planLine = safeQueue.backlog > 0
    ? `${formatExactCount(safeQueue.backlog)} overdue ${overdueWord} ${safeQueue.backlog === 1 ? 'is' : 'are'} from earlier practice.`
    : 'Today\'s stack is ready when you are.'

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

      <p className="mt-4 max-w-[58ch] break-words text-base text-faded-sumi leading-relaxed">
        {deckLine}. {planLine}
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

      <HeroPrimaryAction href="/review/setup">Start reviews</HeroPrimaryAction>
    </HeroLayout>
  )
}

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

      <HeroPrimaryAction href="/review/setup?mode=ahead" variant="secondary">Study ahead</HeroPrimaryAction>
    </HeroLayout>
  )
}

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

      <HeroPrimaryAction href="/decks">Browse decks</HeroPrimaryAction>
    </HeroLayout>
  )
}

function LoadingContent(): React.JSX.Element {
  return (
    <HeroLayout visual={<LoadingDeckStack />}>
      <div className="flex items-baseline gap-3">
        <SkeletonBlock width={34} height={36} className="rounded-[2px]" />
        <SkeletonBlock width={132} height={16} />
      </div>
      <hr aria-hidden="true" className="mt-3 border-0 border-t border-soft-hairline" />

      <SkeletonBlock width="min(440px, 92%)" height={64} className="mt-6 rounded-[4px]" />
      <SkeletonBlock width="min(560px, 100%)" height={20} className="mt-5 rounded-[4px]" />
      <SkeletonBlock width="min(460px, 86%)" height={20} className="mt-2 rounded-[4px]" />

      <div className="mt-8 flex flex-wrap gap-2.5">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} width={116} height={38} className="rounded-full" />
        ))}
      </div>

      <SkeletonBlock width={220} height={56} className="mt-8 rounded-[2px]" />
    </HeroLayout>
  )
}

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
        The dashboard could not reach today&apos;s review queue. Your decks are unchanged; refresh when your connection is back.
      </p>

      <div className="mt-8 flex flex-col items-start gap-4">
        <Link
          href="/today?retry=now"
          className={[
            'inline-flex min-h-14 min-w-[240px] max-w-full flex-wrap items-center justify-center gap-2.5 rounded-[2px] px-8 py-3',
            'bg-error text-base font-medium text-warm-paper-raised',
            'today-motion-transform',
            'hover:-translate-y-0.5 hover:bg-error-deep active:translate-y-0',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-error-deep',
          ].join(' ')}
        >
          Refresh dashboard
          <ArrowGlyph direction="right" />
        </Link>
      </div>
    </HeroLayout>
  )
}

function HeroLayout({
  visual,
  children,
}: {
  visual:   React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const reducedMotion = useReducedMotion()

  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] xl:items-center">
      <motion.div
        className="order-1 min-w-0 px-1 py-2 sm:px-2 lg:py-4 xl:order-none xl:col-start-1 xl:row-start-1"
        initial={reducedMotion === true ? false : { opacity: 0, y: 8 }}
        animate={reducedMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion === true ? 0 : 0.28,
          ease:     EASE_OUT_EXPO,
        }}
      >
        {children}
      </motion.div>

      <motion.div
        className={[
          'order-2 relative flex min-h-[245px] items-center justify-center overflow-visible',
          'py-3 sm:min-h-[320px] sm:py-4 lg:min-h-[350px]',
          'xl:order-none xl:col-start-2 xl:row-start-1',
        ].join(' ')}
        initial={reducedMotion === true ? false : { opacity: 0, y: 10 }}
        animate={reducedMotion === true ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion === true ? 0 : 0.32,
          ease:     EASE_OUT_EXPO,
          delay:    reducedMotion === true ? 0 : 0.04,
        }}
      >
        {visual}
      </motion.div>
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
  const facts = [
    {
      key:   'new',
      label: `${formatCompactCount(safeNewCount)} new ${safeNewCount === 1 ? 'card' : 'cards'}`,
      tone:  safeNewCount > 0 ? 'new' as const : 'neutral' as const,
    },
    {
      key:   'review',
      label: `${formatCompactCount(safeReviewCount)} review ${safeReviewCount === 1 ? 'card' : 'cards'}`,
      tone:  safeReviewCount > 0 ? 'review' as const : 'neutral' as const,
    },
    ...(safeBacklogCount > 0
      ? [{
          key:   'backlog',
          label: `${formatCompactCount(safeBacklogCount)} overdue ${safeBacklogCount === 1 ? 'card' : 'cards'}`,
          tone:  'backlog' as const,
        }]
      : []),
  ]

  return (
    <div
      aria-label="Review queue mix"
      className={[
        'mt-6 flex flex-wrap gap-2',
        quiet ? 'opacity-60' : 'opacity-85',
      ].join(' ')}
    >
      {facts.map((fact) => (
        <span
          key={fact.key}
          className={[
            'inline-flex min-h-9 items-center rounded-full border px-3',
            'max-w-full break-words font-mono text-[0.6875rem] tabular-nums tracking-normal',
            QUEUE_FACT_TONE_CLASSES[fact.tone],
          ].join(' ')}
        >
          {fact.label}
        </span>
      ))}
    </div>
  )
}

const QUEUE_FACT_TONE_CLASSES = {
  neutral: 'border-soft-hairline/80 bg-warm-paper-raised/70 text-faded-sumi',
  new:     'border-queue-new-mark/18 bg-queue-new-wash/55 text-queue-new-mark/85',
  review:  'border-queue-review-mark/18 bg-queue-review-wash/55 text-queue-review-mark/85',
  backlog: 'border-error-deep/20 bg-error-tint/28 text-error-deep/85',
} as const

function HeroPrimaryAction({
  href,
  variant = 'primary',
  children,
}: {
  href:     string
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mt-8">
      <Link
        href={href}
        className={[
          'inline-flex min-h-14 min-w-[280px] max-w-full flex-wrap items-center justify-center gap-2.5 rounded-[2px] px-10 py-3',
          'text-base font-semibold',
          'today-motion-transform',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
          variant === 'primary'
            ? 'today-hero-primary-action bg-inari-vermillion-deep text-warm-paper-raised hover:-translate-y-0.5 hover:bg-inari-vermillion active:translate-y-0'
            : 'border border-soft-hairline bg-warm-paper-raised text-sumi-ink hover:-translate-y-0.5 hover:border-faded-sumi hover:bg-cream-inset active:translate-y-0',
        ].join(' ')}
      >
        {children}
        <ArrowGlyph direction="right" />
      </Link>
    </div>
  )
}

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
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
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
              <SkeletonBlock width={56} height={10} />
              <SkeletonBlock width={42} height={16} className="rounded-full" />
            </div>
            <SkeletonBlock width="78%" height={20} className="mt-5" />
            <SkeletonBlock width="56%" height={14} className="mt-3" />
            <SkeletonBlock width="36%" height={14} className="mt-6" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorQueueVisual(): React.JSX.Element {
  const reducedMotion = useReducedMotion()
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
        <motion.span
          initial={reducedMotion === true ? false : { opacity: 0.7, scale: 0.9 }}
          animate={reducedMotion === true ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{
            duration: reducedMotion === true ? 0 : 0.26,
            ease:     EASE_OUT_EXPO,
          }}
        >
          !
        </motion.span>
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
