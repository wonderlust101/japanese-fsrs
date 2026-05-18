'use client'

import Link from 'next/link'

/**
 * Mirrors the backend's `ApiCardQualityIssueType` enum exactly. Source of
 * truth is the Stage-8 `get_card_quality_issues` RPC, which always emits
 * all six rows (zero-filled if necessary) so the consumer renders a
 * stable shape.
 */
export type CardQualityIssueKind =
  | 'missing_reading'
  | 'missing_meaning'
  | 'missing_example'
  | 'missing_mnemonic'
  | 'missing_picture'
  | 'missing_nuance'

export interface CardQualityIssue {
  kind:  CardQualityIssueKind
  count: number
}

interface CardsQualityBarsProps {
  issues: ReadonlyArray<CardQualityIssue>
}

const QUALITY_ISSUE_LABEL: Readonly<Record<CardQualityIssueKind, string>> = {
  missing_reading:  'Missing reading',
  missing_meaning:  'Missing meaning',
  missing_example:  'Missing example sentence',
  missing_mnemonic: 'Missing mnemonic',
  missing_picture:  'Missing picture',
  missing_nuance:   'Missing nuance note',
}

const ROUTE_BY_KIND: Record<CardQualityIssueKind, string> = {
  missing_reading:  '/cards?missing=reading',
  missing_meaning:  '/cards?missing=meaning',
  missing_example:  '/cards?missing=example',
  missing_mnemonic: '/cards?missing=mnemonic',
  missing_picture:  '/cards?missing=picture',
  missing_nuance:   '/cards?missing=nuance',
}

/**
 * Card-health distribution strip. One horizontal bar per support-field
 * issue type, sorted by count descending. Each row is a link that
 * filters the current `/cards` table by that missing-field query
 * parameter.
 *
 * Migrated from the deleted `/insights/mistakes` page. The component
 * surface is self-contained (no `MistakesData` dependency); the type
 * defs and label map were inlined so the file can stand on its own.
 *
 * Production data source isn't wired yet — when the backend ships
 * per-issue counts, pass them in via `issues`. Empty state reads as
 * a positive when nothing is flagged ("Every card has its support
 * fields filled in.").
 */
export function CardsQualityBars({
  issues,
}: CardsQualityBarsProps): React.JSX.Element {
  const sorted   = [...issues].sort((a, b) => b.count - a.count)
  const maxCount = Math.max(1, ...sorted.map((i) => i.count))

  if (sorted.length === 0) {
    return (
      <p className="rounded-[2px] border border-dashed border-soft-hairline bg-cream-inset/50 px-5 py-6 text-sm italic leading-relaxed text-faded-sumi">
        Every card has its support fields filled in.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      <ul role="list" className="flex flex-col divide-y divide-soft-hairline border-y border-soft-hairline">
        {sorted.map((issue) => {
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
        Click a row to filter the table by that missing field.
      </p>
    </div>
  )
}
