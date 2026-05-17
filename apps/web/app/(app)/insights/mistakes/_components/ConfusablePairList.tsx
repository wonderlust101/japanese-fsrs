import Link from 'next/link'

import { FuriganaText } from '@/components/ui/FuriganaText'

import { buildConfusablesLine } from './mistakesInterpretation'
import type { MistakesData } from './mistakesTypes'

interface ConfusablePairListProps {
  data: MistakesData
}

/**
 * Confusable Items body. Pair entries with an `↔` ornament between the
 * two words, the confusion count, and a quiet link to open the pair in
 * Cards. When the backend signal isn't available (the production case
 * until the confusable-detection endpoint lands), render a single
 * dashed note explaining the gap.
 */
export function ConfusablePairList({ data }: ConfusablePairListProps): React.JSX.Element {
  const pairs = data.confusables

  if (pairs.length === 0) {
    return (
      <div className="rounded-[2px] border border-dashed border-soft-hairline bg-cream-inset/50 px-5 py-6 text-sm leading-relaxed text-faded-sumi">
        <p className="text-sumi-ink/85">
          Confusable detection is rolling out in the next backend pass.
        </p>
        <p className="mt-2">
          Once the signal is live, this section will list word pairs you&rsquo;ve
          recently mixed up, with the confusion count and a quick link to open
          both cards.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-5">
      <p className="max-w-prose text-sm italic leading-relaxed text-sumi-ink/85">
        {buildConfusablesLine(data)}
      </p>

      <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {pairs.map((pair) => (
          <li
            key={pair.id}
            className="flex flex-col gap-y-3 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-4 py-3.5"
          >
            <div className="flex items-center gap-x-4">
              <div className="flex flex-col">
                <span className="font-display text-[1.0625rem] text-sumi-ink">
                  <FuriganaText text={pair.aWord} reading={pair.aReading} />
                </span>
              </div>
              <span aria-hidden="true" className="font-display text-[1.125rem] text-faded-sumi">
                ↔
              </span>
              <div className="flex flex-col">
                <span className="font-display text-[1.0625rem] text-sumi-ink">
                  <FuriganaText text={pair.bWord} reading={pair.bReading} />
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
              <span>
                <span className="text-sumi-ink/85 tabular-nums">{pair.confusions}</span>{' '}
                confusions
              </span>
              <div className="flex items-center gap-x-4">
                <Link
                  href={`/cards/${pair.aCardId}`}
                  className="underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
                >
                  Open {pair.aWord}
                </Link>
                <Link
                  href={`/cards/${pair.bCardId}`}
                  className="underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
                >
                  Open {pair.bWord}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
