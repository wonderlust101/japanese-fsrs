'use client'

import Link from 'next/link'

import { MistakeRowList } from './MistakeRowList'
import { buildLeechesLine } from './mistakesInterpretation'
import type { LeechRow, MistakesData } from './mistakesTypes'

interface LeechesListProps {
  data: MistakesData
}

/**
 * Leeches SectionCard body. Italic line + a single "Repair all" quiet
 * link, followed by the leech rows using the shared MistakeRowList
 * primitive. The diagnosis string (when available) renders below each
 * row's main content as an additional editorial line — that's the
 * leech-detection pipeline's teacher voice and earns its own emphasis.
 */
export function LeechesList({ data }: LeechesListProps): React.JSX.Element {
  const leeches = data.leeches

  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="max-w-prose text-sm italic leading-relaxed text-sumi-ink/85">
          {buildLeechesLine(data)}
        </p>
        {leeches.length > 0 && (
          <Link
            href="/insights/leeches"
            className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            Open weak spots →
          </Link>
        )}
      </div>

      <MistakeRowList<LeechRow>
        rows={leeches}
        emptyText="No leeches in this window. The pile is clean."
        renderExtra={(row) =>
          row.diagnosis !== undefined && row.diagnosis !== '' ? (
            <p className="mt-1 max-w-prose text-[0.8125rem] italic leading-relaxed text-faded-sumi">
              {row.diagnosis}
            </p>
          ) : null
        }
      />
    </div>
  )
}
