/**
 * Shared section primitives for the dashboard's editorial chapter rhythm.
 *
 * v6 introduces `CardHeader` as the primary header pattern: a vermillion
 * kanji ornament + small-caps mono label, hairline rule below. All eight
 * section cards (Hero / Stats / Forecast / Decks / Leeches / Recent / JLPT)
 * use this header except Tomo, which keeps its letterhead variant.
 *
 * `SectionHeader` (vermillion-square mark + Bricolage label) is retained for
 * any future bare-on-page module that doesn't sit inside a card.
 */

import Link from 'next/link'

// ── CardHeader (kanji ornament + small-caps mono + right action + rule) ──────

interface CardHeaderProps {
  /** Single kanji or 2-char compound. Single chars render at text-2xl, compounds at text-xl. */
  kanji:    string
  /** Small-caps mono label rendered after the kanji. */
  label:    string
  /** Optional count rendered after the label as " · {n}". */
  count?:   number
  /** Optional right-aligned content (typically a Link or static span). */
  rightContent?: React.ReactNode
}

export function CardHeader({ kanji, label, count, rightContent }: CardHeaderProps): React.JSX.Element {
  // 2-char compounds render slightly smaller so the ornament's visual mass stays
  // balanced with single-kanji cards. text-2xl on 1-char vs text-xl on 2-char keeps
  // total ornament width comparable across the dashboard.
  const isCompound = kanji.length > 1
  const kanjiSize  = isCompound ? 'text-xl' : 'text-2xl'
  const kanjiGap   = isCompound ? 'gap-2.5' : 'gap-3'

  return (
    <header className="mb-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={`flex items-baseline ${kanjiGap}`}>
          <span
            lang="ja"
            aria-hidden="true"
            className={`font-display ${kanjiSize} text-inari-vermillion leading-none translate-y-[0.05em] select-none`}
          >
            {kanji}
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
            {label}
            {count !== undefined && (
              <span className="ml-1.5 text-faded-sumi/85">· {count}</span>
            )}
          </span>
        </h2>
        {rightContent !== undefined && (
          <div className="shrink-0 font-mono text-xs text-faded-sumi tracking-wide">
            {rightContent}
          </div>
        )}
      </div>
      <hr aria-hidden="true" className="mt-3 border-0 border-t border-soft-hairline" />
    </header>
  )
}

// ── SectionHeader (legacy: vermillion-square mark + Bricolage label) ─────────

interface SectionHeaderProps {
  title:    string
  /** Optional small count rendered as " · {n}" beside the title in Faded Sumi. */
  count?:   number
  /** Optional right-aligned content (typically a Link or static span). */
  rightContent?: React.ReactNode
}

export function SectionHeader({ title, count, rightContent }: SectionHeaderProps): React.JSX.Element {
  return (
    <header className="mb-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-base tracking-[-0.005em] text-sumi-ink flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="inline-block w-1 h-1 bg-inari-vermillion translate-y-[-0.15em] shrink-0"
          />
          <span>{title}</span>
          {count !== undefined && (
            <span className="text-faded-sumi font-normal">· {count}</span>
          )}
        </h2>
        {rightContent !== undefined && (
          <div className="shrink-0 font-mono text-xs text-faded-sumi tracking-wide">
            {rightContent}
          </div>
        )}
      </div>
      <hr aria-hidden="true" className="mt-3 border-0 border-t border-soft-hairline" />
    </header>
  )
}

// ── DATA_CARD_CHROME constant: shared chrome for all data cards ──────────────

/**
 * Standard data-card chrome: warm-paper-raised + 1px hairline + 2px corner
 * radius + responsive padding. Used by Stats / Forecast / Decks / Leeches /
 * Recent / JLPT cards. Voice cards (Hero, Tomo) layer a 2px vermillion top
 * stripe on top of this by adding `border-t-2 border-t-inari-vermillion` and
 * dropping the top border from the hairline (border-l border-r border-b).
 */
export const DATA_CARD_CHROME = [
  'bg-warm-paper-raised',
  'border border-soft-hairline rounded-[2px]',
  'p-7 sm:p-8 lg:p-10',
].join(' ')

// ── Skeleton primitives ──────────────────────────────────────────────────────

interface SkeletonBlockProps {
  className?: string
  width?:     string | number
  height?:    string | number
}

/**
 * Pulse-animated skeleton block. Tinted toward the warm-paper neutrals so the
 * skeleton reads as "paper waiting" rather than "gray rectangle." Uses
 * Tailwind's `animate-pulse` (opacity oscillation) which respects
 * prefers-reduced-motion via globals.css's @media query.
 */
export function SkeletonBlock({
  className = '',
  width,
  height,
}: SkeletonBlockProps): React.JSX.Element {
  const style: React.CSSProperties = {}
  if (width  !== undefined) style.width  = typeof width  === 'number' ? `${width}px`  : width
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      aria-hidden="true"
      className={`bg-soft-hairline/55 rounded-[2px] animate-pulse ${className}`}
      style={style}
    />
  )
}

interface SkeletonRowProps {
  /** Width pairs for `flex` segments (e.g. `[60, 30, 10]` for 3 columns). */
  segments: number[]
  /** Skeleton block height in px. Defaults to 16. */
  height?: number
}

export function SkeletonRow({ segments, height = 16 }: SkeletonRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      {segments.map((width, i) => (
        <SkeletonBlock
          key={i}
          height={height}
          className=""
          width={`${width}%`}
        />
      ))}
    </div>
  )
}

// ── Error state ──────────────────────────────────────────────────────────────

interface ModuleErrorProps {
  /**
   * Where the retry link goes. Should re-render the page or the specific
   * module path. In practice, links back to the same page (which re-fetches
   * server data on navigation) or to a `?retry=now` variant.
   */
  retryHref?: string
  message?:   string
}

/**
 * Per-module error state: a quiet italic line with a "retry →" affordance
 * in vermillion. Reads as "we couldn't reach this; try again" without
 * shouting.
 */
export function ModuleError({
  retryHref = '?retry=now',
  message   = "Couldn't reach this just now.",
}: ModuleErrorProps): React.JSX.Element {
  return (
    <p className="text-sm text-faded-sumi italic max-w-md">
      {message}
      <Link
        href={retryHref}
        className="ml-2 not-italic text-inari-vermillion hover:text-inari-vermillion-deep underline-offset-4 hover:underline transition-colors"
      >
        retry →
      </Link>
    </p>
  )
}

// ── Module state type ────────────────────────────────────────────────────────

export type ModuleState = 'default' | 'loading' | 'error'
