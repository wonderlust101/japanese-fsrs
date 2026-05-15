'use client'

import Link from 'next/link'

import {
  clampPercent,
  formatExactCount,
  safeNonNegativeInteger,
} from '@/app/(app)/today/_components/today-format'
import {
  ConnectionErrorNotice,
  SkeletonBlock,
  type ModuleState,
} from '@/app/(app)/today/_components/section-primitives'
import { JlptPill, type JlptPillLevel } from '@/components/ui/Pill'

import { pluralizeCards } from './staging-format'

export interface PinnedDeck {
  id:              string
  title:           string
  level:           JlptPillLevel | null
  dueCount:        number
  newCount:        number
  reviewCount:     number
  backlogCount:    number
  totalCards:      number
  masteryPercent?: number | null
}

export interface TomoNote {
  /** Optional ISO date the note was generated. */
  date?:    string | null
  /** The note's body as already-trimmed text (no Markdown, no HTML). */
  body:     string
}

interface StagingPinnedDeckProps {
  state:       ModuleState
  deck:        PinnedDeck | null
  note:        TomoNote | null
  /** Empty teaching tiles when the user has no decks at all. */
  isFirstTime: boolean
}

const SECTION_DESCRIPTION = "The first deck in your shelf order leads each day. Reorder in /decks to change which deck appears here."

export function StagingPinnedDeck({
  state,
  deck,
  note,
  isFirstTime,
}: StagingPinnedDeckProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <Shell variant="compact">
        <DeckLoadingBody />
      </Shell>
    )
  }

  if (state === 'error') {
    return (
      <Shell variant="compact">
        <div className="min-h-[12rem] py-6">
          <ConnectionErrorNotice sectionName="Today's deck" />
        </div>
      </Shell>
    )
  }

  if (isFirstTime) {
    return (
      <Shell variant="first-time">
        <FirstTimeTiles />
      </Shell>
    )
  }

  if (deck === null) {
    return (
      <Shell variant="empty">
        <EmptyShelfMessage />
      </Shell>
    )
  }

  return (
    <Shell variant="default">
      <DeckBody deck={deck} note={note} />
    </Shell>
  )
}

// ── Shell with v2 padding rhythm ─────────────────────────────────────────────

function Shell({
  children,
  variant,
}: {
  children: React.ReactNode
  variant:  'default' | 'compact' | 'first-time' | 'empty'
}): React.JSX.Element {
  const padding = variant === 'default'
    ? 'px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9'
    : 'px-5 py-6 sm:px-6 sm:py-7 lg:px-7 lg:py-7'

  return (
    <section
      aria-labelledby="staging-pinned-deck-heading"
      className={[
        'relative overflow-hidden rounded-[2px]',
        'border border-soft-hairline bg-warm-paper-raised',
        padding,
      ].join(' ')}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-inari-vermillion" />

      <header className="mb-5">
        <div className="flex min-w-0 items-baseline justify-between gap-4">
          <h2
            id="staging-pinned-deck-heading"
            className="flex min-w-0 flex-wrap items-baseline gap-2.5"
          >
            <span
              lang="ja"
              aria-hidden="true"
              className="shrink-0 whitespace-nowrap font-display text-xl text-inari-vermillion leading-none translate-y-[0.05em] select-none"
            >
              今日
            </span>
            <span className="min-w-0 break-words font-mono text-sm font-medium uppercase tracking-normal text-sumi-ink/80">
              Today&apos;s deck
            </span>
          </h2>

          <Link
            href="/decks"
            className={[
              'shrink-0 inline-flex min-h-7 items-center px-1 rounded-[2px]',
              'font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi',
              'transition-colors duration-200 ease-out',
              'hover:text-sumi-ink hover:underline underline-offset-4',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45',
            ].join(' ')}
          >
            Reorder → /decks
          </Link>
        </div>

        <p className="mt-2 max-w-[58ch] break-words text-[0.8125rem] leading-[1.55] text-faded-sumi">
          {SECTION_DESCRIPTION}
        </p>
        <hr aria-hidden="true" className="mt-4 border-0 border-t border-soft-hairline" />
      </header>

      {children}
    </section>
  )
}

// ── Default body (deck + Tomo note) ──────────────────────────────────────────

function DeckBody({
  deck,
  note,
}: {
  deck: PinnedDeck
  note: TomoNote | null
}): React.JSX.Element {
  const _reducedMotion = false
  const mastery = deck.masteryPercent !== undefined && deck.masteryPercent !== null
    ? clampPercent(deck.masteryPercent)
    : null
  const totalCards = safeNonNegativeInteger(deck.totalCards)
  const breakdownLine = buildBreakdownLine(deck)

  return (
    <div    >
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="break-words font-display text-2xl leading-tight text-sumi-ink sm:text-3xl">
              {deck.title}
            </span>
            {deck.level !== null && <JlptPill level={deck.level} size="sm" />}
          </p>
          <p className="mt-1 font-mono text-[0.75rem] text-faded-sumi">
            {formatExactCount(totalCards)} {pluralizeCards(totalCards)} in deck
          </p>
        </div>

        <p className="shrink-0 font-mono text-xl tabular-nums text-sumi-ink sm:text-2xl">
          {formatExactCount(deck.dueCount)}
          <span className="ml-1 text-base text-faded-sumi">due</span>
        </p>
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-4">
        <DeckProgress percent={mastery} level={deck.level} />
        <span className="font-mono text-[0.75rem] text-faded-sumi tabular-nums sm:text-right">
          {breakdownLine}
        </span>
      </div>

      <TomoNoteBlock note={note} />
    </div>
  )
}

function DeckProgress({
  percent,
  level,
}: {
  percent: number | null
  level:   JlptPillLevel | null
}): React.JSX.Element {
  if (percent === null) {
    return (
      <div className="flex items-center gap-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] text-faded-sumi">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full border border-soft-hairline bg-warm-paper-raised" />
        No progress yet
      </div>
    )
  }

  const fillClass = level !== null ? PROGRESS_FILL[level] : 'bg-aizome-indigo'

  return (
    <div className="flex w-full items-center gap-3">
      <div
        role="progressbar"
        aria-label="Deck mastery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded-[1px] border border-soft-hairline/70 bg-cream-inset"
      >
        {percent > 0 && (
          <div aria-hidden="true" className={`h-full ${fillClass}`} style={{ width: `${percent}%` }} />
        )}
      </div>
      <span className="shrink-0 font-mono text-[0.8125rem] tabular-nums text-sumi-ink/85">
        {percent}%
      </span>
    </div>
  )
}

function TomoNoteBlock({ note }: { note: TomoNote | null }): React.JSX.Element {
  const hasNote = note !== null && note.body.trim().length > 0

  return (
    <div className="mt-7">
      <hr aria-hidden="true" className="mb-5 border-0 border-t border-soft-hairline/70" />
      <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-sumi-ink/70">
        Tomo notes
      </p>
      {hasNote ? (
        <p className="max-w-[68ch] break-words text-[0.9375rem] leading-relaxed text-sumi-ink">
          {note.body}
        </p>
      ) : (
        <p className="max-w-[58ch] break-words text-sm leading-relaxed text-faded-sumi">
          Tomo&apos;s notes appear here when there&apos;s something worth saying.
        </p>
      )}
    </div>
  )
}

// ── First-time + empty bodies ────────────────────────────────────────────────

function FirstTimeTiles(): React.JSX.Element {
  const tiles = [
    {
      level:       'N5' as JlptPillLevel,
      kanji:       '五',
      title:       'JLPT N5 vocabulary',
      description: 'The first ~800 words and a daily rhythm to learn them.',
      href:        '/decks?level=N5',
    },
    {
      level:       'N4' as JlptPillLevel,
      kanji:       '漢',
      title:       'Joyo kanji recognition',
      description: 'A slow build through the Joyo kanji at a pace you set.',
      href:        '/decks?type=kanji',
    },
    {
      level:       'beyond_jlpt' as JlptPillLevel,
      kanji:       '文',
      title:       'Grammar patterns',
      description: 'Short example-driven grammar from N5 through Beyond.',
      href:        '/decks?type=grammar',
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <FirstTimeTile key={tile.href} tile={tile} />
      ))}
    </div>
  )
}

function FirstTimeTile({
  tile,
}: {
  tile:  { level: JlptPillLevel; kanji: string; title: string; description: string; href: string }
}): React.JSX.Element {
  const _reducedMotion = false
  return (
    <div      className="relative overflow-hidden rounded-[2px] border border-soft-hairline bg-cream-inset/40 px-4 py-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          lang="ja"
          aria-hidden="true"
          className="font-display text-xl leading-none text-inari-vermillion"
        >
          {tile.kanji}
        </span>
        <JlptPill level={tile.level} size="sm" />
      </div>
      <h4 className="mt-3 break-words font-display text-base leading-tight text-sumi-ink">
        {tile.title}
      </h4>
      <p className="mt-1.5 break-words text-[0.8125rem] leading-relaxed text-faded-sumi">
        {tile.description}
      </p>
      <Link
        href={tile.href}
        className="group mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-[2px] px-1 font-mono text-xs tracking-wide text-inari-vermillion underline-offset-4 transition-colors duration-200 ease-out hover:text-inari-vermillion-deep hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45"
      >
        Browse
        <span aria-hidden="true" className="transition-transform duration-200 ease-out group-hover:translate-x-0.5">→</span>
      </Link>
    </div>
  )
}

function EmptyShelfMessage(): React.JSX.Element {
  return (
    <div className="py-4">
      <p className="font-display text-lg text-sumi-ink">Nothing due in this deck today.</p>
      <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-faded-sumi">
        Your shelf is quiet. Open a deck to study ahead, or wait for cards to come due.
      </p>
    </div>
  )
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function DeckLoadingBody(): React.JSX.Element {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
        <SkeletonBlock width="48%" height={28} />
        <SkeletonBlock width={68} height={20} />
      </div>
      <SkeletonBlock width="100%" height={8} className="mt-5 rounded-[1px]" />
      <SkeletonBlock width="78%" height={16} className="mt-3" />
      <SkeletonBlock width="32%" height={12} className="mt-7" />
      <SkeletonBlock width="92%" height={16} className="mt-3" />
      <SkeletonBlock width="84%" height={16} className="mt-1.5" />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROGRESS_FILL: Record<JlptPillLevel, string> = {
  N5:          'bg-deck-n5-mark',
  N4:          'bg-deck-n4-mark',
  N3:          'bg-deck-n3-mark',
  N2:          'bg-deck-n2-mark',
  N1:          'bg-deck-n1-mark',
  beyond:      'bg-deck-beyond-mark',
  beyond_jlpt: 'bg-deck-beyond-mark',
  kana:        'bg-deck-n4-mark',
}

function buildBreakdownLine(deck: PinnedDeck): string {
  const parts: string[] = []
  if (deck.newCount > 0)     parts.push(`${formatExactCount(deck.newCount)} new`)
  if (deck.reviewCount > 0)  parts.push(`${formatExactCount(deck.reviewCount)} review`)
  if (deck.backlogCount > 0) parts.push(`${formatExactCount(deck.backlogCount)} overdue`)
  if (parts.length === 0)    return 'no cards due'
  return parts.join('  ·  ')
}
