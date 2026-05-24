'use client'

import type { ApiDueCard } from '@fsrs-japanese/shared-types'

import { cn } from '@/lib/utils'
import { VocabHero } from './VocabHero'
import { resolveCardFields } from './card-fields'
import { useSentenceSwapKey } from './useSentenceSwapKey'

interface CardFrontProps {
  card: ApiDueCard
  /**
   * Pin which example sentence renders, bypassing the per-review rotation.
   * Used by the /add/review preview pager so changing the sentence updates
   * the front as well as the back. Omitted in a real review session.
   */
  exampleSentenceIndex?: number
}

// The session surface currently only renders Comprehension cards. The Front
// is a tight column: a small mode kicker, the headword (no ruby on the
// front), and an example sentence below when one is present. Reveal flips
// to the unified back composition.

export function CardFront({ card, exampleSentenceIndex }: CardFrontProps): React.JSX.Element {
  const fields = resolveCardFields(card, exampleSentenceIndex)
  // Replays the sentence's entrance when the pager steps to another example,
  // matching the cue on the card back (SentenceBand). See useSentenceSwapKey.
  const swapKey = useSentenceSwapKey(exampleSentenceIndex)

  return (
    <article className="flex w-full flex-col items-center gap-8 md:gap-10 py-4 md:py-8">
      <div className="flex flex-col items-center gap-7 text-center">
        <VocabHero word={fields.word} reading={fields.reading} hideRuby />
        {fields.exampleSentence !== null && (
          <p
            key={swapKey}
            lang="ja"
            className={cn(
              'font-japanese text-lg md:text-xl text-sumi-ink/80 leading-relaxed max-w-measure [overflow-wrap:anywhere]',
              swapKey > 0 && 'animate-sentence-swap',
            )}
          >
            {fields.exampleSentence.ja}
          </p>
        )}
      </div>
    </article>
  )
}
