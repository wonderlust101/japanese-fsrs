import Link from 'next/link'

import { ArrowGlyph } from '@/components/icons/arrow-glyph'
import { CramMark, DrillMark } from '@/components/icons/dashboard-marks'
import { Logo } from '@/components/ui/Logo'

import { CardHeader, ModuleError, SkeletonBlock } from './section-primitives'

interface DueQueue {
  total:  number
  newCnt: number
  review: number
  hasLeeches: boolean
}

type HeroVariant =
  | { kind: 'due';        queue: DueQueue }
  | { kind: 'caught-up' }
  | { kind: 'first-time' }
  | { kind: 'loading' }
  | { kind: 'error' }

interface DashboardHeroProps {
  variant: HeroVariant
}

/**
 * Dashboard hero: warm-paper-raised card with 2px vermillion top stripe (voice
 * module). v6 restructures the header: instead of a centered TODAY'S PRACTICE
 * anchor, a top-left CardHeader (今 + TODAY) matches the kanji-card pattern
 * established across all other carded modules. Content (headline + buttons)
 * remains centered below the header.
 *
 * First-time replaces the kanji header with a centered kitsune mark to signal
 * a milestone; the card's vermillion stripe carries the chapter break.
 */
export function DashboardHero({ variant }: DashboardHeroProps): React.JSX.Element {
  return (
    <section
      // Switched from aria-labelledby="hero-headline" to a literal aria-label
      // because the hero's <h2 id="hero-headline"> is conditionally rendered
      // (omitted in the loading variant) and a dangling labelledby reference
      // is a worse accessibility outcome than a stable literal label.
      aria-label="Today's practice"
      className={[
        'relative bg-warm-paper-raised',
        'border-l border-r border-b border-soft-hairline',
        'border-t-2 border-t-inari-vermillion',
        'rounded-[2px]',
        'p-7 sm:p-8 lg:p-10',
      ].join(' ')}
    >
      {variant.kind === 'first-time' ? (
        <div className="text-center px-2 sm:px-6 lg:px-8 py-4 lg:py-6">
          <FirstTimeContent />
        </div>
      ) : (
        <>
          <CardHeader kanji="今" label="Today" />
          <div className="text-center px-2 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 lg:pb-6">
            {variant.kind === 'due'        && <DueContent       queue={variant.queue} />}
            {variant.kind === 'caught-up'  && <CaughtUpContent  />}
            {variant.kind === 'loading'    && <LoadingContent   />}
            {variant.kind === 'error'      && <ErrorContent     />}
          </div>
        </>
      )}
    </section>
  )
}

// ─── Due state ───────────────────────────────────────────────────────────────

function DueContent({ queue }: { queue: DueQueue }): React.JSX.Element {
  const { total, newCnt, review, hasLeeches } = queue
  const cardWord = total === 1 ? 'card' : 'cards'

  const queueParts = [
    newCnt > 0 ? `${newCnt} new`    : null,
    review > 0 ? `${review} review` : null,
  ].filter(Boolean)

  const queueLine = queueParts.length > 0
    ? `${queueParts.join(' · ')} · ready when you are`
    : 'ready when you are'

  return (
    <>
      <h2
        id="hero-headline"
        className="font-display text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem] leading-[1] tracking-[-0.02em] text-sumi-ink"
      >
        {total} {cardWord} waiting
      </h2>

      <p className="mt-4 text-base text-faded-sumi">
        {queueLine}
      </p>

      <div className="mt-10 flex flex-col items-center gap-5">
        <Link
          href="/review"
          className={[
            'inline-flex items-center justify-center gap-2.5 h-14 px-10 min-w-[280px] sm:min-w-[320px] rounded-[2px]',
            'text-base font-medium text-warm-paper-raised bg-inari-vermillion',
            'transition-[background-color] duration-150 ease-out',
            'hover:bg-inari-vermillion-deep',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          Start Review
          <ArrowGlyph direction="right" />
        </Link>

        <SecondaryActionRow>
          {hasLeeches && (
            <Link
              href="/review?mode=drill"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-faded-sumi hover:text-sumi-ink transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px]"
            >
              <DrillMark />
              Drill leeches
            </Link>
          )}

          <Link
            href="/review?mode=cram"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-faded-sumi hover:text-sumi-ink transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px]"
          >
            <CramMark />
            Cram a deck
          </Link>
        </SecondaryActionRow>
      </div>
    </>
  )
}

/**
 * Secondary action row used under hero CTAs. Renders children inline,
 * separated by mid-dot separators. Reads as "or these" rather than as
 * additional buttons. Filters out falsy children.
 */
function SecondaryActionRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  const items = (Array.isArray(children) ? children : [children])
    .filter(Boolean)

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
      {items.map((child, i) => (
        <span key={i} className="flex items-center gap-3">
          {child}
          {i < items.length - 1 && (
            <span aria-hidden="true" className="text-faded-sumi/40">·</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ─── Caught-up state ─────────────────────────────────────────────────────────

function CaughtUpContent(): React.JSX.Element {
  return (
    <>
      <div className="flex justify-center mb-5">
        <Logo size={56} showWordmark={false} />
      </div>

      <h2
        id="hero-headline"
        className="font-display text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem] leading-[1] tracking-[-0.02em] text-sumi-ink"
      >
        Caught up.
        <span className="block mt-1 text-faded-sumi font-normal">
          Enjoy your morning.
        </span>
      </h2>

      <p className="mt-5 mx-auto text-base text-faded-sumi max-w-md">
        Nothing&apos;s due. The schedule will bring more cards back when they&apos;re close to fading.
      </p>

      <div className="mt-10 flex flex-col items-center gap-5">
        <Link
          href="/review?mode=ahead"
          className={[
            'inline-flex items-center justify-center gap-2.5 h-14 px-10 min-w-[280px] sm:min-w-[320px] rounded-[2px]',
            'text-base font-medium text-sumi-ink bg-warm-paper-raised border border-soft-hairline',
            'transition-[background-color,border-color] duration-150 ease-out',
            'hover:bg-cream-inset hover:border-faded-sumi',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          Study ahead
          <ArrowGlyph direction="right" />
        </Link>

        <SecondaryActionRow>
          <Link
            href="/decks/browse"
            className="inline-flex items-center text-sm font-medium text-faded-sumi hover:text-sumi-ink transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px]"
          >
            Browse decks
          </Link>
          <Link
            href="/review?mode=drill"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-faded-sumi hover:text-sumi-ink transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 rounded-[2px]"
          >
            <DrillMark />
            Drill leeches
          </Link>
        </SecondaryActionRow>
      </div>
    </>
  )
}

// ─── First-time state (no anchor — kitsune is the anchor) ────────────────────

function FirstTimeContent(): React.JSX.Element {
  return (
    <>
      <div className="flex justify-center mb-5 mt-2">
        <Logo size={64} showWordmark={false} />
      </div>

      <h2
        id="hero-headline"
        className="font-display text-[2rem] sm:text-[2.75rem] lg:text-[3.25rem] leading-[1.05] tracking-[-0.018em] text-sumi-ink"
      >
        Let&apos;s queue up your first deck.
      </h2>

      <p className="mt-5 mx-auto text-base text-faded-sumi max-w-md">
        Tomo ships with curated JLPT decks, Joyo kanji sets, and grammar patterns. Pick one and your morning practice begins tomorrow.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
        <Link
          href="/decks/browse"
          className={[
            'inline-flex items-center justify-center gap-2 h-11 px-6 rounded-[2px]',
            'text-sm font-medium text-warm-paper-raised bg-inari-vermillion',
            'hover:bg-inari-vermillion-deep transition-colors duration-150 ease-out',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          Browse decks
          <ArrowGlyph direction="right" />
        </Link>

        <Link
          href="/decks/new"
          className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-[2px] text-sm font-medium text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          Or build your own
        </Link>
      </div>
    </>
  )
}

// ─── Loading state ───────────────────────────────────────────────────────────

function LoadingContent(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <SkeletonBlock width="320px" height={56} className="rounded-[4px]" />
      <SkeletonBlock width="280px" height={20} className="mt-5 rounded-[4px]" />
      <div className="mt-9 flex items-center gap-2">
        <SkeletonBlock width={140} height={44} />
        <SkeletonBlock width={120} height={44} />
        <SkeletonBlock width={120} height={44} />
      </div>
    </div>
  )
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorContent(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-md">
      <h2
        id="hero-headline"
        className="font-display text-[2rem] sm:text-[2.5rem] leading-[1.1] tracking-[-0.018em] text-sumi-ink"
      >
        Couldn&apos;t reach Tomo just now.
      </h2>
      <p className="mt-4 text-base text-faded-sumi">
        Sometimes the schedule takes a moment to load. Refresh and we&apos;ll try again.
      </p>
      <div className="mt-7">
        <ModuleError retryHref="/dashboard" message="" />
      </div>
    </div>
  )
}
