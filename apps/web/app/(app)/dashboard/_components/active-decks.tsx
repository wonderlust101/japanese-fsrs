'use client'

import Link from 'next/link'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'
import { JlptPill, type JlptPillLevel } from '@/components/ui/Pill'

import {
  clampPercent,
  formatExactCount,
  safeNonNegativeInteger,
} from './dashboard-format'
import { DashboardRowMotion } from './dashboard-motion'
import {
  CardHeader,
  ConnectionErrorNotice,
  EmptyState,
  LIST_MODULE_CHROME,
  type ModuleState,
  SkeletonBlock,
  UnavailableState,
} from './section-primitives'

export type JlptLevel = JlptPillLevel

export interface ActiveDeck {
  id:                  string
  title:               string
  level?:              JlptLevel | null
  dueCount?:           number
  totalCards:          number
  newCount?:           number
  reviewCount?:        number
  masteryPercent?:     number
  lastReviewedRel?:    string | null
  statsAvailable?:     boolean
}

interface ActiveDecksProps {
  state:  ModuleState
  decks?: ActiveDeck[]
}

const DECKS_DESCRIPTION = 'Decks in your current study shelf.'

export function ActiveDecks({ state, decks = [] }: ActiveDecksProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="decks-label" aria-busy="true" className={LIST_MODULE_CHROME}>
        <CardHeader
          id="decks-label"
          kanji="教材"
          label="Your decks"
          variant="compact"
          description={DECKS_DESCRIPTION}
          rightContent={<SkeletonBlock width={56} height={11} />}
        />
        <ul className="-mx-2 sm:-mx-3">
          {[60, 45, 70, 50].map((width, i) => (
            <DashboardRowMotion
              key={i}
              index={i}
              interactive={false}
              className="border-b border-soft-hairline/60 px-2 py-4 last:border-b-0 sm:px-3"
            >
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock width={`${width}%`} height={16} />
                <SkeletonBlock width={48} height={14} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SkeletonBlock width={88} height={12} />
                <SkeletonBlock width={104} height={12} />
                <SkeletonBlock width={72} height={12} />
              </div>
              <SkeletonBlock width="100%" height={5} className="mt-4 rounded-[1px]" />
            </DashboardRowMotion>
          ))}
        </ul>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="decks-label" className={LIST_MODULE_CHROME}>
        <CardHeader
          id="decks-label"
          kanji="教材"
          label="Your decks"
          variant="compact"
          description={DECKS_DESCRIPTION}
        />
        <div className="min-h-[14rem] py-6">
          <ConnectionErrorNotice sectionName="Your active decks" />
        </div>
      </section>
    )
  }

  if (state === 'unavailable') {
    return (
      <section aria-labelledby="decks-label" className={LIST_MODULE_CHROME}>
        <CardHeader
          id="decks-label"
          kanji="教材"
          label="Your decks"
          variant="compact"
          description={DECKS_DESCRIPTION}
        />
        <UnavailableState
          title="Deck data is not connected yet"
          body="You can still review from the main queue. Once deck rollups are available, this list will show level, progress, and due cards for each deck."
          action={{ href: '/review', label: "Review today's stack" }}
        />
      </section>
    )
  }

  const normalizedDecks = decks.map(normalizeDeck)

  if (normalizedDecks.length === 0) {
    return (
      <section aria-labelledby="decks-label" className={LIST_MODULE_CHROME}>
        <CardHeader
          id="decks-label"
          kanji="教材"
          label="Your decks"
          variant="compact"
          description={DECKS_DESCRIPTION}
        />
        <EmptyShelf />
      </section>
    )
  }

  return (
    <section aria-labelledby="decks-label" className={LIST_MODULE_CHROME}>
      <CardHeader
        id="decks-label"
        kanji="教材"
        label="Your decks"
        count={normalizedDecks.length}
        variant="compact"
        description={DECKS_DESCRIPTION}
        rightContent={
          <Link
            href="/decks"
            className="dashboard-motion-colors -mx-2 inline-flex min-h-11 items-center rounded-[2px] px-2 underline-offset-4 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45"
          >
            all decks →
          </Link>
        }
      />

      <ul className="-mx-2 mt-1 divide-y divide-soft-hairline/70 sm:-mx-3">
        {normalizedDecks.map((deck, index) => {
          const deckHref = deck.id.length > 0
            ? `/decks/${encodeURIComponent(deck.id)}`
            : '/decks'

          return (
            <DashboardRowMotion
              key={`${deck.id}-${index}`}
              index={index}
              className="first:pt-0"
            >
              <Link
                href={deckHref}
                className={[
                  'dashboard-motion-colors group block rounded-[2px] px-2 py-4 sm:px-3',
                  'hover:bg-cream-inset/55',
                  'focus-visible:bg-cream-inset focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                ].join(' ')}
              >
                <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <DeckIndex index={index} />
                    <span className="min-w-[8rem] flex-1 truncate text-base font-medium text-sumi-ink">
                      {deck.title}
                    </span>
                    {deck.level != null && <JlptPill level={deck.level} size="sm" />}
                  </span>

                  <span className="flex shrink-0 items-center justify-between gap-3.5 md:justify-end">
                    <DueCount count={deck.dueCount} />
                    <span className="dashboard-motion-transform text-faded-sumi group-hover:translate-x-0.5 group-hover:text-sumi-ink">
                      <ArrowGlyph direction="right" />
                    </span>
                  </span>
                </div>

                <div className="mt-2.5 pl-8">
                  <DeckMeta
                    masteryPercent={deck.masteryPercent}
                    totalCards={deck.totalCards}
                    newCount={deck.newCount}
                    reviewCount={deck.reviewCount}
                    lastReviewedRel={deck.lastReviewedRel}
                  />
                </div>

                <div className="mt-3 pl-8">
                  <FullWidthProgress percent={deck.masteryPercent} level={deck.level} />
                </div>
              </Link>
            </DashboardRowMotion>
          )
        })}
      </ul>
    </section>
  )
}

function DeckIndex({ index }: { index: number }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[1px] border border-soft-hairline bg-cream-inset font-mono text-[0.625rem] font-medium tabular-nums text-faded-sumi"
    >
      {String(index + 1).padStart(2, '0')}
    </span>
  )
}

function EmptyShelf(): React.JSX.Element {
  return (
    <EmptyState
      title="Your study shelf is ready"
      body="Choose one deck and this shelf starts feeding daily reviews, progress, and due cards here."
      action={{ href: '/decks/browse', label: 'Browse decks' }}
      visual="shelf"
    />
  )
}

// ── Due count (line 1 right) ─────────────────────────────────────────────────

function DueCount({ count }: { count: number | undefined }): React.JSX.Element {
  if (count === undefined) {
    return (
      <span className="font-mono text-sm tabular-nums text-faded-sumi">
        Open
      </span>
    )
  }

  const safeCount = safeNonNegativeInteger(count)

  if (safeCount === 0) {
    return (
      <span className="font-mono text-sm text-faded-sumi tabular-nums">
        0 due
      </span>
    )
  }
  return (
    <span className="font-mono text-sm text-sumi-ink tabular-nums">
      {formatExactCount(safeCount)}
      <span className="text-faded-sumi"> due</span>
    </span>
  )
}

// ── Deck meta (line 2) ───────────────────────────────────────────────────────

function DeckMeta({
  masteryPercent,
  totalCards,
  newCount,
  reviewCount,
  lastReviewedRel,
}: {
  masteryPercent:  number | undefined
  totalCards:      number
  newCount:        number | undefined
  reviewCount:     number | undefined
  lastReviewedRel: string | null | undefined
}): React.JSX.Element {
  const dot = <span aria-hidden="true" className="text-faded-sumi/45 mx-1.5">·</span>
  const hasReviewStats = masteryPercent !== undefined
  const safeTotalCards = safeNonNegativeInteger(totalCards)
  const safeNewCount = newCount !== undefined ? safeNonNegativeInteger(newCount) : undefined
  const safeReviewCount = reviewCount !== undefined ? safeNonNegativeInteger(reviewCount) : undefined

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-y-0.5 break-words font-mono text-xs tracking-wide text-faded-sumi tabular-nums">
      {hasReviewStats && (
        <>
          <span className="text-sumi-ink/85 font-medium">{masteryPercent}%</span>
          {dot}
        </>
      )}
      <span>{formatExactCount(safeTotalCards)} cards</span>
      {safeNewCount !== undefined && safeReviewCount !== undefined && (safeNewCount > 0 || safeReviewCount > 0) && (
        <>
          {dot}
          <span>{formatExactCount(safeNewCount)} new</span>
          <span aria-hidden="true" className="text-faded-sumi/45 mx-1">·</span>
          <span>{formatExactCount(safeReviewCount)} review</span>
        </>
      )}
      {!hasReviewStats && (
        <>
          {dot}
          <span>open deck</span>
        </>
      )}
      {lastReviewedRel != null && (
        <>
          {dot}
          <span className="min-w-0 break-words">{lastReviewedRel}</span>
        </>
      )}
    </span>
  )
}

// ── Full-width progress bar (line 3, JLPT level color) ───────────────────────

const PROGRESS_FILL: Record<JlptLevel, string> = {
  N5:          'bg-deck-n5-mark',
  N4:          'bg-deck-n4-mark',
  N3:          'bg-deck-n3-mark',
  N2:          'bg-deck-n2-mark',
  N1:          'bg-deck-n1-mark',
  beyond:      'bg-deck-beyond-mark',
  beyond_jlpt: 'bg-deck-beyond-mark',
  kana:        'bg-deck-n4-mark',
}

// Unleveled decks (no JLPT level, e.g. Joyo Kanji Set 1) use Aizome-Indigo
// as their mastery-bar fill. Adds a third semantic role for Aizome alongside
// the high-retention number tiers in stats / recent activity: "data outside
// the JLPT taxonomy that still deserves emphasis."
const PROGRESS_FILL_NEUTRAL = 'bg-aizome-indigo'

function FullWidthProgress({
  percent,
  level,
}: {
  percent: number | undefined
  level:   JlptLevel | null | undefined
}): React.JSX.Element {
  if (percent === undefined) {
    return (
      <div className="flex items-center gap-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] text-faded-sumi">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full border border-soft-hairline bg-warm-paper-raised"
        />
        <span>No progress yet</span>
      </div>
    )
  }

  const safe      = clampPercent(percent)
  const fillClass = level != null ? PROGRESS_FILL[level] : PROGRESS_FILL_NEUTRAL

  return (
    <div
      role="progressbar"
      aria-label="Deck mastery"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safe)}
      aria-valuetext={`${Math.round(safe)}% mastery`}
      className="w-full h-2.5 bg-cream-inset rounded-[2px] overflow-hidden border border-soft-hairline/70"
    >
      {safe > 0 && (
        <div
          aria-hidden="true"
          className={`h-full ${fillClass}`}
          style={{ width: `${safe}%` }}
        />
      )}
    </div>
  )
}

function normalizeDeck(deck: ActiveDeck): ActiveDeck {
  const {
    dueCount,
    lastReviewedRel,
    masteryPercent,
    newCount,
    reviewCount,
    title,
    totalCards,
    ...rest
  } = deck

  return {
    ...rest,
    title:           title.trim() || 'Untitled deck',
    totalCards:      safeNonNegativeInteger(totalCards),
    lastReviewedRel: lastReviewedRel?.trim() || null,
    ...(dueCount === undefined ? {} : { dueCount: safeNonNegativeInteger(dueCount) }),
    ...(newCount === undefined ? {} : { newCount: safeNonNegativeInteger(newCount) }),
    ...(reviewCount === undefined ? {} : { reviewCount: safeNonNegativeInteger(reviewCount) }),
    ...(masteryPercent === undefined ? {} : { masteryPercent: clampPercent(masteryPercent) }),
  }
}
