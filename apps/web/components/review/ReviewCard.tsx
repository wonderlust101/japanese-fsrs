'use client'

import { useEffect }     from 'react'
import { FuriganaText }  from '@/components/ui/FuriganaText'
import { RatingButtons } from './RatingButtons'
import {
  useCurrentCard,
  useShowAnswer,
  useSessionActions,
} from '@/stores/useReviewSessionStore'
import { CardType, getWordFields, getVocabularyFields, getSentenceFrontBack } from '@fsrs-japanese/shared-types'
import type { UserRating } from '@fsrs-japanese/shared-types'

const CARD_TYPE_LABEL: Record<string, string> = {
  [CardType.Comprehension]: 'Reading',
  [CardType.Production]:    'Writing',
  [CardType.Listening]:     'Listening',
}

export function ReviewCard(): React.JSX.Element | null {
  const card       = useCurrentCard()
  const showAnswer = useShowAnswer()
  const { flipCard, submitRating } = useSessionActions()

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return

      if (!showAnswer) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          flipCard()
        }
      } else {
        const ratingMap: Record<string, UserRating> = {
          '1': 'again', '2': 'hard', '3': 'good', '4': 'easy',
        }
        const rating = ratingMap[e.key]
        if (rating !== undefined) submitRating(rating)
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showAnswer, flipCard, submitRating])

  if (!card) return null

  // Narrow on layoutType — vocabulary/grammar share WordFields; sentence falls
  // back to free-form `front`/`back` keys via getSentenceFrontBack.
  const wordFields = getWordFields(card)
  const sentence   = getSentenceFrontBack(card)
  const word    = wordFields?.word    ?? sentence?.front ?? ''
  const reading = wordFields?.reading ?? null
  const meaning = wordFields?.meaning ?? sentence?.back  ?? ''
  const firstSentence = getVocabularyFields(card)?.exampleSentences?.[0]

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-4">
      <div className="w-full max-w-[640px] rounded-[14px] shadow-card bg-warm-paper-raised flex flex-col overflow-hidden">

        <div className="flex items-center px-5 pt-5">
          <span className="text-xs font-medium text-faded-sumi bg-cream-inset rounded-full px-2.5 py-0.5">
            {CARD_TYPE_LABEL[card.cardType] ?? card.cardType}
          </span>
        </div>

        <div className="flex flex-col items-center px-12 pt-8 pb-8">
          <p lang="ja" className="text-3xl font-japanese font-medium text-center text-sumi-ink">
            {word}
          </p>

          {!showAnswer && (
            <div className="mt-8 flex flex-col items-center gap-1.5">
              <button
                onClick={flipCard}
                className="px-6 py-2 rounded-lg bg-cream-inset hover:bg-cream-inset text-sm font-medium text-sumi-ink transition-colors"
              >
                Show Answer
              </button>
              <span className="text-xs text-faded-sumi">or press Space</span>
            </div>
          )}
        </div>

        {showAnswer && (
          <div className="animate-card-reveal flex flex-col gap-4 px-12 pb-10 border-t border-soft-hairline pt-6">
            {reading !== null && reading !== '' && (
              <FuriganaText
                text={word}
                reading={reading}
                className="text-xl font-japanese"
              />
            )}

            <p className="text-base text-sumi-ink">{meaning}</p>

            {firstSentence !== undefined && (
              <div className="rounded-lg bg-cream-inset p-4 flex flex-col gap-1">
                <FuriganaText
                  text={firstSentence.ja}
                  reading={firstSentence.furigana}
                  className="text-sm font-japanese text-sumi-ink"
                />
                <p className="text-sm text-faded-sumi">{firstSentence.en}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showAnswer && <RatingButtons onRate={submitRating} />}
    </div>
  )
}
