import Link from 'next/link'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'

import { CardHeader, DATA_CARD_CHROME, ModuleError, type ModuleState, SkeletonBlock } from './section-primitives'

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond_jlpt'

export interface ActiveDeck {
  id:                  string
  title:               string
  level:               JlptLevel | null
  dueCount:            number
  totalCards:          number
  newCount:            number
  reviewCount:         number
  masteryPercent:      number
  lastReviewedRel:     string | null
}

interface ActiveDecksProps {
  state:  ModuleState
  decks?: ActiveDeck[]
}

export function ActiveDecks({ state, decks = [] }: ActiveDecksProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="decks-label" className={DATA_CARD_CHROME}>
        <CardHeader id="decks-label" kanji="教材" label="Decks" rightContent={<SkeletonBlock width={56} height={11} />} />
        <ul className="-mx-2 sm:-mx-3 divide-y divide-soft-hairline/60">
          {[60, 45, 70, 50].map((width, i) => (
            <li key={i} className="px-2 sm:px-3 py-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock width={`${width}%`} height={16} />
                <SkeletonBlock width={48} height={14} />
              </div>
              <SkeletonBlock width="80%" height={12} />
              <SkeletonBlock width="100%" height={6} className="rounded-[1px]" />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="decks-label" className={DATA_CARD_CHROME}>
        <CardHeader id="decks-label" kanji="教材" label="Decks" />
        <ModuleError message="Couldn't load your decks." />
      </section>
    )
  }

  if (decks.length === 0) {
    return (
      <section aria-labelledby="decks-label" className={DATA_CARD_CHROME}>
        <CardHeader id="decks-label" kanji="教材" label="Decks" />
        <p className="text-sm text-faded-sumi italic max-w-md leading-relaxed">
          Quiet shelf. Pick a deck to begin.{' '}
          <Link
            href="/decks/browse"
            className="not-italic text-inari-vermillion hover:text-inari-vermillion-deep underline-offset-4 hover:underline transition-colors"
          >
            Browse decks →
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="decks-label" className={DATA_CARD_CHROME}>
      <CardHeader
        kanji="教材"
        label="Decks"
        count={decks.length}
        rightContent={
          <Link
            href="/decks"
            className="hover:text-sumi-ink underline-offset-4 hover:underline transition-colors"
          >
            all decks →
          </Link>
        }
      />

      <ul className="-mx-2 sm:-mx-3 divide-y divide-soft-hairline/60">
        {decks.map((deck) => (
          <li key={deck.id}>
            <Link
              href={`/decks/${deck.id}`}
              className="group block px-2 sm:px-3 py-5 rounded-[2px] transition-colors duration-150 ease-out hover:bg-cream-inset focus-visible:bg-cream-inset focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-1px]"
            >
              {/* Line 1: title + badge + due + arrow */}
              <div className="flex items-center gap-3">
                <span className="flex-1 min-w-0 flex items-center gap-2.5">
                  <span className="truncate text-base text-sumi-ink font-medium">
                    {deck.title}
                  </span>
                  {deck.level !== null && <JlptBadge level={deck.level} />}
                </span>

                <span className="shrink-0 flex items-center gap-3.5">
                  <DueCount count={deck.dueCount} />
                  <span className="text-faded-sumi transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-sumi-ink">
                    <ArrowGlyph direction="right" />
                  </span>
                </span>
              </div>

              {/* Line 2: meta */}
              <div className="mt-3">
                <DeckMeta
                  masteryPercent={deck.masteryPercent}
                  totalCards={deck.totalCards}
                  newCount={deck.newCount}
                  reviewCount={deck.reviewCount}
                  lastReviewedRel={deck.lastReviewedRel}
                />
              </div>

              {/* Line 3: full-width progress bar */}
              <div className="mt-4">
                <FullWidthProgress percent={deck.masteryPercent} level={deck.level} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── JLPT badge ───────────────────────────────────────────────────────────────

const JLPT_STYLES: Record<JlptLevel, { bg: string; text: string; label: string }> = {
  N5:          { bg: 'bg-deck-n5-wash',     text: 'text-deck-n5-mark',     label: 'N5'     },
  N4:          { bg: 'bg-deck-n4-wash',     text: 'text-deck-n4-mark',     label: 'N4'     },
  N3:          { bg: 'bg-deck-n3-wash',     text: 'text-deck-n3-mark',     label: 'N3'     },
  N2:          { bg: 'bg-deck-n2-wash',     text: 'text-deck-n2-mark',     label: 'N2'     },
  N1:          { bg: 'bg-deck-n1-wash',     text: 'text-deck-n1-mark',     label: 'N1'     },
  beyond_jlpt: { bg: 'bg-deck-beyond-wash', text: 'text-deck-beyond-mark', label: 'BEYOND' },
}

function JlptBadge({ level }: { level: JlptLevel }): React.JSX.Element {
  const { bg, text, label } = JLPT_STYLES[level]
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full font-mono text-[0.625rem] font-medium tracking-[0.06em] ${bg} ${text}`}
      aria-label={`Level ${label}`}
    >
      {label}
    </span>
  )
}

// ── Due count (line 1 right) ─────────────────────────────────────────────────

function DueCount({ count }: { count: number }): React.JSX.Element {
  if (count === 0) {
    return (
      <span className="font-mono text-sm text-faded-sumi tabular-nums">
        0 due
      </span>
    )
  }
  return (
    <span className="font-mono text-sm text-sumi-ink tabular-nums">
      {count}
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
  masteryPercent:  number
  totalCards:      number
  newCount:        number
  reviewCount:     number
  lastReviewedRel: string | null
}): React.JSX.Element {
  const dot = <span aria-hidden="true" className="text-faded-sumi/45 mx-1.5">·</span>

  return (
    <span className="font-mono text-xs text-faded-sumi tabular-nums tracking-wide flex items-center flex-wrap gap-y-0.5">
      <span className="text-sumi-ink/85 font-medium">{masteryPercent}%</span>
      {dot}
      <span>{totalCards.toLocaleString()} cards</span>
      {(newCount > 0 || reviewCount > 0) && (
        <>
          {dot}
          <span>{newCount} new</span>
          <span aria-hidden="true" className="text-faded-sumi/45 mx-1">·</span>
          <span>{reviewCount} review</span>
        </>
      )}
      {lastReviewedRel !== null && (
        <>
          {dot}
          <span>{lastReviewedRel}</span>
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
  beyond_jlpt: 'bg-deck-beyond-mark',
}

// Unleveled decks (no JLPT level, e.g. Joyo Kanji Set 1) use Aizome-Indigo
// as their mastery-bar fill. Adds a third semantic role for Aizome alongside
// the high-retention number tiers in stats / recent activity: "data outside
// the JLPT taxonomy that still deserves emphasis."
const PROGRESS_FILL_NEUTRAL = 'bg-aizome-indigo'

function FullWidthProgress({ percent, level }: { percent: number; level: JlptLevel | null }): React.JSX.Element {
  const safe      = Math.min(100, Math.max(0, percent))
  const fillClass = level !== null ? PROGRESS_FILL[level] : PROGRESS_FILL_NEUTRAL

  return (
    <div className="w-full h-2 bg-soft-hairline/45 rounded-[1px] overflow-hidden">
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
