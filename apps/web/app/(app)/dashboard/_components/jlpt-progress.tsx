import Link from 'next/link'

import type { JlptLevel } from './active-decks'
import { CardHeader, DATA_CARD_CHROME, ModuleError, type ModuleState, SkeletonBlock } from './section-primitives'

export interface JlptLevelProgress {
  level:   JlptLevel
  percent: number
}

interface JlptProgressProps {
  state:   ModuleState
  levels?: JlptLevelProgress[]
}

/**
 * JLPT progress as 6 stacked full-width bars, one per level. Each bar uses
 * the JLPT spectrum color for that level (N5 fresh leaf, N4 deep emerald,
 * etc.); empty portion is `bg-soft-hairline/40`. The current level (argmax
 * by percent) gets a 2px Inari Vermillion tick directly under its bar.
 *
 * Display order is N5 first → beyond_jlpt last (foundational to aspirational
 * top-down), reading as a learning sequence rather than a journey climb.
 *
 * Mobile (< 768px): label / bar / percent + status word stack as 3 lines per
 * level row.
 */
/**
 * Display order: top → bottom = summit → foundation. Reading top-to-bottom
 * scans from `beyond_jlpt` at the peak down to N5 at the base, which matches
 * the climb-up mental model: "where you're heading" sits at the top, "where
 * you started" sits at the bottom. The user's eye rises from the foundation.
 */
const DISPLAY_ORDER: JlptLevel[] = ['beyond_jlpt', 'N1', 'N2', 'N3', 'N4', 'N5']

const LEVEL_LABEL: Record<JlptLevel, string> = {
  N5:          'N5',
  N4:          'N4',
  N3:          'N3',
  N2:          'N2',
  N1:          'N1',
  beyond_jlpt: 'beyond',
}

const LEVEL_FILL: Record<JlptLevel, string> = {
  N5:          'bg-deck-n5-mark',
  N4:          'bg-deck-n4-mark',
  N3:          'bg-deck-n3-mark',
  N2:          'bg-deck-n2-mark',
  N1:          'bg-deck-n1-mark',
  beyond_jlpt: 'bg-deck-beyond-mark',
}

type NodeKind = 'locked' | 'started' | 'working' | 'nearly' | 'mastered'

function nodeKindFor(percent: number): NodeKind {
  if (percent >= 100) return 'mastered'
  if (percent >= 80)  return 'nearly'
  if (percent >= 30)  return 'working'
  if (percent >= 1)   return 'started'
  return 'locked'
}

function statusLabelFor(kind: NodeKind): string {
  switch (kind) {
    case 'mastered': return 'mastered'
    case 'nearly':   return 'nearly there'
    case 'working':  return 'working'
    case 'started':  return 'started'
    case 'locked':   return 'locked'
  }
}

/**
 * "Current" means the level the user is actively working on. Excludes both
 * unstarted (0%) and fully mastered (>=100%) levels — a 100%-mastered level
 * is "done," not "current." Picks the argmax of percent among in-progress
 * levels (1-99%); if none qualify, returns null.
 */
function findCurrent(levels: JlptLevelProgress[]): JlptLevel | null {
  const inProgress = levels.filter((l) => l.percent > 0 && l.percent < 100)
  if (inProgress.length === 0) return null
  return inProgress.reduce((best, l) => (l.percent > best.percent ? l : best)).level
}

export function JlptProgress({ state, levels = [] }: JlptProgressProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="jlpt-label" className={DATA_CARD_CHROME}>
        <CardHeader id="jlpt-label" kanji="級" label="JLPT progress" rightContent={<SkeletonBlock width={96} height={11} />} />
        <ol className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <li key={i} className="flex items-center gap-4">
              <SkeletonBlock width={36} height={12} />
              <SkeletonBlock width="100%" height={24} />
              <SkeletonBlock width={48} height={12} />
              <SkeletonBlock width={80} height={12} />
            </li>
          ))}
        </ol>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="jlpt-label" className={DATA_CARD_CHROME}>
        <CardHeader id="jlpt-label" kanji="級" label="JLPT progress" />
        <ModuleError message="Couldn't load JLPT progress." />
      </section>
    )
  }

  if (levels.length === 0) {
    return (
      <section aria-labelledby="jlpt-label" className={DATA_CARD_CHROME}>
        <CardHeader id="jlpt-label" kanji="級" label="JLPT progress" />
        <p className="text-sm text-faded-sumi italic max-w-md leading-relaxed">
          Empty journey. Subscribe to a deck to begin.{' '}
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

  const byLevel    = Object.fromEntries(levels.map((l) => [l.level, l.percent])) as Record<JlptLevel, number>
  const current    = findCurrent(levels)
  const inProgress = levels.filter((l) => l.percent > 0).length

  return (
    <section aria-labelledby="jlpt-label" className={DATA_CARD_CHROME}>
      <CardHeader
        id="jlpt-label"
        kanji="級"
        label="JLPT progress"
        rightContent={<span>{inProgress} of 6 in progress</span>}
      />

      <ol className="space-y-4 sm:space-y-3">
        {DISPLAY_ORDER.map((level) => {
          const percent   = byLevel[level] ?? 0
          const kind      = nodeKindFor(percent)
          const status    = statusLabelFor(kind)
          const isCurrent = level === current

          return (
            <LevelRow
              key={level}
              level={level}
              percent={percent}
              status={status}
              isCurrent={isCurrent}
              fillClass={LEVEL_FILL[level]}
            />
          )
        })}
      </ol>
    </section>
  )
}

// ── Level row ────────────────────────────────────────────────────────────────

function LevelRow({
  level,
  percent,
  status,
  isCurrent,
  fillClass,
}: {
  level:     JlptLevel
  percent:   number
  status:    string
  isCurrent: boolean
  fillClass: string
}): React.JSX.Element {
  const label = LEVEL_LABEL[level]

  return (
    <li>
      {/* Desktop / tablet: label, bar, percent, status all inline */}
      <div className="hidden sm:flex items-center gap-4">
        <span
          className={[
            'font-mono text-xs tracking-wide w-14 shrink-0',
            level === 'beyond_jlpt' ? 'text-faded-sumi' : 'text-sumi-ink font-medium',
          ].join(' ')}
        >
          {label}
        </span>
        <div className="flex-1 relative">
          <Bar percent={percent} fillClass={fillClass} />
          {isCurrent && (
            <span aria-hidden="true" className="absolute left-0 right-0 -bottom-1 h-[2px] bg-inari-vermillion" />
          )}
        </div>
        <span className="font-mono text-xs tabular-nums text-faded-sumi w-10 text-right shrink-0">
          {percent}%
        </span>
        <span
          className={[
            'font-mono text-xs tracking-wide w-24 shrink-0',
            isCurrent ? 'text-inari-vermillion' : 'text-faded-sumi',
          ].join(' ')}
        >
          {isCurrent ? 'current' : status}
        </span>
      </div>

      {/* Mobile: label / bar / percent + status stacked as 3 lines */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between mb-2">
          <span
            className={[
              'font-mono text-xs tracking-wide',
              level === 'beyond_jlpt' ? 'text-faded-sumi' : 'text-sumi-ink font-medium',
            ].join(' ')}
          >
            {label}
          </span>
          {isCurrent && (
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-inari-vermillion">
              current
            </span>
          )}
        </div>
        <div className="relative mb-2">
          <Bar percent={percent} fillClass={fillClass} />
          {isCurrent && (
            <span aria-hidden="true" className="absolute left-0 right-0 -bottom-1 h-[2px] bg-inari-vermillion" />
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs tabular-nums text-faded-sumi">{percent}%</span>
          <span className="font-mono text-xs text-faded-sumi tracking-wide">{status}</span>
        </div>
      </div>
    </li>
  )
}

// ── Bar (24px tall full-width) ───────────────────────────────────────────────

function Bar({ percent, fillClass }: { percent: number; fillClass: string }): React.JSX.Element {
  const safe = Math.min(100, Math.max(0, percent))
  return (
    <div className="relative w-full h-6 bg-soft-hairline/40 rounded-[2px] overflow-hidden">
      {safe > 0 && (
        <div
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 ${fillClass}`}
          style={{ width: `${safe}%` }}
        />
      )}
    </div>
  )
}
