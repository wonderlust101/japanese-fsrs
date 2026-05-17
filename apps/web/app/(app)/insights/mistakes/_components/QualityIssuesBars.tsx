import Link from 'next/link'

import { buildQualityLine } from './mistakesInterpretation'
import {
  QUALITY_ISSUE_LABEL,
  type MistakesData,
  type QualityIssueKind,
} from './mistakesTypes'

interface QualityIssuesBarsProps {
  data: MistakesData
}

const ROUTE_BY_KIND: Record<QualityIssueKind, string> = {
  'missing-audio':           '/cards?missing=audio',
  'missing-sentence':        '/cards?missing=sentence',
  'missing-kanji-breakdown': '/cards?missing=kanji-breakdown',
  'missing-mnemonic':        '/cards?missing=mnemonic',
  'missing-nuance':          '/cards?missing=nuance',
}

/**
 * Quality Issues body. Horizontal bars, one per issue type, sorted by
 * count descending. The bar fill uses vermillion-deep at /55 alpha —
 * present but not alarming. Counts are rendered to the right of each
 * bar, tabular-nums. Each row is a link that opens the Cards page with
 * the relevant filter applied (route stub OK until the filter lands).
 *
 * Per the brief (Q7=B), the visualization is a horizontal bar chart,
 * not a pie. Pies are the SaaS cliché the design laws warn against.
 */
export function QualityIssuesBars({ data }: QualityIssuesBarsProps): React.JSX.Element {
  const issues = [...data.qualityIssues].sort((a, b) => b.count - a.count)
  const maxCount = Math.max(1, ...issues.map((i) => i.count))

  if (issues.length === 0) {
    return (
      <p className="rounded-[2px] border border-dashed border-soft-hairline bg-cream-inset/50 px-5 py-6 text-sm italic leading-relaxed text-faded-sumi">
        Every card has its support fields filled in.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-y-5">
      <p className="max-w-prose text-sm italic leading-relaxed text-sumi-ink/85">
        {buildQualityLine(data)}
      </p>

      <ul role="list" className="flex flex-col divide-y divide-soft-hairline border-y border-soft-hairline">
        {issues.map((issue) => {
          const widthPct = (issue.count / maxCount) * 100
          return (
            <li key={issue.kind}>
              <Link
                href={ROUTE_BY_KIND[issue.kind]}
                className="group grid grid-cols-[12rem_1fr_auto] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-cream-inset/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-2px] sm:grid-cols-[16rem_1fr_auto]"
              >
                <span className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-sumi-ink">
                  {QUALITY_ISSUE_LABEL[issue.kind]}
                </span>
                <div className="relative h-3 w-full overflow-hidden rounded-[2px] bg-cream-inset">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 bg-inari-vermillion-deep/55 transition-[width] duration-300 ease-out"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="font-mono text-[0.8125rem] tabular-nums text-sumi-ink">
                  {issue.count.toLocaleString('en-US')}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        Click a row to open the matching cards in your library.
      </p>
    </div>
  )
}
