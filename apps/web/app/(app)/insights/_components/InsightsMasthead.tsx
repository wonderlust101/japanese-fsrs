import { Logo } from '@/components/ui/Logo'

interface InsightsMastheadProps {
  weekStart:  string
  weekEnd:    string
  weekNumber: number
}

const MONTHS = [
  'January',  'February', 'March',    'April',   'May',      'June',
  'July',     'August',   'September','October', 'November', 'December',
] as const

function rangeLabel(startIso: string, endIso: string): string {
  const [sy, sm, sd] = startIso.split('-').map(Number) as [number, number, number]
  const [ey, em, ed] = endIso.split('-').map(Number) as [number, number, number]
  const startMonth = MONTHS[(sm ?? 1) - 1] as string
  const endMonth   = MONTHS[(em ?? 1) - 1] as string
  if (sy !== ey) return `${startMonth} ${sd}, ${sy} – ${endMonth} ${ed}, ${ey}`
  if (sm !== em) return `${startMonth} ${sd} – ${endMonth} ${ed}, ${ey}`
  return `${startMonth} ${sd}–${ed}, ${ey}`
}

/**
 * Editorial newspaper-style masthead for the Insights Overview. The kitsune
 * mark anchors the identity position on the left; a spaced-uppercase brand
 * line names the report; a mono date stamp sets the frame; a 1px sumi
 * hairline closes the masthead. Used only on /insights (Overview); deeper
 * tabs keep the layout's existing eyebrow chrome.
 */
export function InsightsMasthead({
  weekStart,
  weekEnd,
  weekNumber,
}: InsightsMastheadProps): React.JSX.Element {
  return (
    <header className="flex flex-col gap-y-5">
      <div className="flex items-center gap-x-4 sm:gap-x-5">
        <Logo size={48} showWordmark={false} priority />
        <div className="flex min-w-0 flex-col gap-y-1.5">
          <p className="text-[0.8125rem] font-medium uppercase leading-none tracking-[0.28em] text-sumi-ink sm:text-[0.9375rem] sm:tracking-[0.34em]">
            Tomo&nbsp;&nbsp;·&nbsp;&nbsp;Insights
          </p>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
            Week {String(weekNumber).padStart(2, '0')} · {rangeLabel(weekStart, weekEnd)}
          </p>
        </div>
      </div>
      <hr aria-hidden="true" className="border-0 border-t border-sumi-ink/25" />
    </header>
  )
}
