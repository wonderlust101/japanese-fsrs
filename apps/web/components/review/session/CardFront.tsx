'use client'

import type { ApiDueCard } from '@fsrs-japanese/shared-types'

import { VocabHero } from './VocabHero'
import { resolveCardFields } from './card-fields'

interface CardFrontProps {
  card: ApiDueCard
}

// The session surface currently only renders Comprehension cards. The Front
// is a tight column: a small mode kicker, the headword (no ruby on the
// front), and an example sentence below when one is present. Reveal flips
// to the unified back composition.

export function CardFront({ card }: CardFrontProps): React.JSX.Element {
  const fields = resolveCardFields(card)

  return (
    <article className="flex w-full flex-col items-center gap-8 md:gap-10 py-4 md:py-8">
      <div className="flex flex-col items-center gap-7 text-center">
        <VocabHero word={fields.word} reading={fields.reading} hideRuby />
        {fields.exampleSentence !== null && (
          <p lang="ja" className="font-japanese text-lg md:text-xl text-sumi-ink/80 leading-relaxed max-w-[60ch]">
            {fields.exampleSentence.ja}
          </p>
        )}
      </div>
    </article>
  )
}
