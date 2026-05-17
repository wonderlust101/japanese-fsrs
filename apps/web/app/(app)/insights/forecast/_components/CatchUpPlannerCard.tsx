import Link from 'next/link'

import type { ApiForecastDay } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'
import { QuietLink } from '@/components/ui/QuietLink'
import { cn } from '@/lib/utils'

interface CatchUpPlannerCardProps {
  forecast: ReadonlyArray<ApiForecastDay>
}

interface Scenario {
  key:        'quick' | 'moderate' | 'steady'
  label:      string
  days:       number
  perDay:     number
  recommended: boolean
}

/**
 * Catch-up planner. Two faces:
 *
 *  - When backlog exists: three scenario tiles (Quick / Moderate / Steady)
 *    showing the daily load required to clear the overdue queue across
 *    different recovery horizons. Moderate is the recommended pick.
 *  - When the user is caught up: a quiet accomplishment moment featuring
 *    a vermillion hi-no-maru disc, the `整` kanji, and a celebratory line.
 *    Per PRODUCT.md, joy is structural — not a confetti pile, but a
 *    deliberate visual beat that says "well done."
 */
export function CatchUpPlannerCard({
  forecast,
}: CatchUpPlannerCardProps): React.JSX.Element {
  const ordered = [...forecast].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 14)
  const backlog = ordered.reduce((acc, d) => acc + d.backlogCount, 0)

  if (backlog <= 0) {
    return <AllClearMoment />
  }

  const scenarios: Scenario[] = [
    { key: 'quick',    label: 'Quick',    days: 3, perDay: Math.ceil(backlog / 3), recommended: false },
    { key: 'moderate', label: 'Moderate', days: 5, perDay: Math.ceil(backlog / 5), recommended: true },
    { key: 'steady',   label: 'Steady',   days: 7, perDay: Math.ceil(backlog / 7), recommended: false },
  ]

  return (
    <SectionCard
      kanji="整"
      label="Catch up"
      description={`${backlog} overdue ${backlog === 1 ? 'card is' : 'cards are'} waiting. Three ways to bring the queue back to current.`}
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3 sm:gap-x-5">
        {scenarios.map((sc) => (
          <ScenarioTile key={sc.key} scenario={sc} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Link
          href="/today"
          className={cn(
            'inline-flex h-10 items-center rounded-[2px] px-4 text-sm font-medium',
            'bg-inari-vermillion text-warm-paper-raised',
            'transition-colors duration-150 ease-out',
            'hover:bg-inari-vermillion-deep',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          )}
        >
          Start a session
        </Link>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
          Moderate is the gentle middle.
        </span>
      </div>
    </SectionCard>
  )
}

// ── Scenario tile ───────────────────────────────────────────────────────────

function ScenarioTile({ scenario }: { scenario: Scenario }): React.JSX.Element {
  const { label, days, perDay, recommended } = scenario
  return (
    <div
      className={cn(
        'flex flex-col gap-y-2 rounded-[2px] border px-4 py-4',
        recommended
          ? 'border-inari-vermillion bg-vermillion-wash/40'
          : 'border-soft-hairline bg-cream-inset/55',
      )}
    >
      <div className="flex items-baseline justify-between gap-x-3">
        <span
          className={cn(
            'font-mono text-[0.6875rem] uppercase tracking-[0.18em]',
            recommended ? 'text-inari-vermillion-deep' : 'text-faded-sumi',
          )}
        >
          {label}
        </span>
        {recommended && (
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-inari-vermillion-deep">
            Recommended
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-x-2">
        <span className="font-display text-[1.75rem] font-medium leading-none tabular-nums text-sumi-ink">
          {perDay}
        </span>
        <span className="text-[0.8125rem] text-faded-sumi">/ day</span>
      </div>
      <p className="text-[0.8125rem] leading-relaxed text-sumi-ink/85">
        Clears the backlog in <span className="font-medium text-sumi-ink">{days} days</span>.
      </p>
    </div>
  )
}

// ── All clear celebration ───────────────────────────────────────────────────

function AllClearMoment(): React.JSX.Element {
  return (
    <SectionCard kanji="整" label="Catch up" omitTitle>
      <div className="flex flex-col items-center gap-y-6 py-6 text-center">
        {/* Hi-no-maru disc with the 整 kanji reversed out in warm paper.
            A small ✦ sits above as the brand's quiet "well done" glyph. */}
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute -top-7 font-display text-[1.25rem] leading-none text-inari-vermillion-deep"
          >
            ✦
          </span>
          <span
            aria-hidden="true"
            className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-inari-vermillion"
          >
            <span
              lang="ja"
              className="select-none font-display text-[2.5rem] font-medium leading-none text-warm-paper-raised"
            >
              整
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-y-2">
          <p className="font-display text-[1.625rem] leading-[1.2] text-sumi-ink">
            All clear.
          </p>
          <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-faded-sumi">
            No overdue cards waiting. The schedule is yours to set today, with nothing pulling at you from yesterday.
          </p>
        </div>

        <div className="pt-1">
          <QuietLink href="/today" tone="brand" trailingArrow size="md">
            Start today&rsquo;s review
          </QuietLink>
        </div>
      </div>
    </SectionCard>
  )
}
