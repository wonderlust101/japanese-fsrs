import type { MistakesData } from './mistakesTypes'

interface PatternSummaryProps {
  data: MistakesData
}

/**
 * Pattern Summary body. Editorial diagnosis sentence + chip row.
 * No chart, per the brief. Chips deep-link to the relevant SectionCard
 * anchor on the page.
 */
export function PatternSummary({ data }: PatternSummaryProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-y-5">
      <p className="max-w-prose text-base italic leading-relaxed text-sumi-ink/90">
        {data.patternDiagnosis}
      </p>

      {data.chips.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-2">
          {data.chips.map((chip) => (
            <li key={chip.href}>
              <a
                href={chip.href}
                className="group inline-flex items-baseline gap-x-2 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 transition-colors hover:border-sumi-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
              >
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
                  {chip.label}
                </span>
                <span className="text-sm text-sumi-ink">{chip.value}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
