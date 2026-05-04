'use client'

import { useEffect }     from 'react'
import { FuriganaText }  from '@/components/ui/FuriganaText'
import { RatingButtons } from './RatingButtons'
import {
  useCurrentCard,
  useShowAnswer,
  useSessionActions,
} from '@/stores/useReviewSessionStore'
import { CardType }          from '@fsrs-japanese/shared-types'
import type { ReviewRating } from '@fsrs-japanese/shared-types'

const CARD_TYPE_LABEL: Record<string, string> = {
  [CardType.Comprehension]: 'Reading',
  [CardType.Production]:    'Writing',
  [CardType.Listening]:     'Listening',
}

interface ExampleSentence {
  ja:       string
  en:       string
  furigana: string
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
        const ratingMap: Record<string, ReviewRating> = {
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

  const fd              = card.fieldsData
  const word            = (fd['word'] as string | undefined) ?? (fd['front'] as string | undefined) ?? ''
  const reading         = (fd['reading'] as string | undefined) ?? null
  const meaning         = (fd['meaning'] as string | undefined) ?? (fd['back'] as string | undefined) ?? ''
  const exampleSentences = fd['exampleSentences'] as ExampleSentence[] | undefined
  const firstSentence   = exampleSentences?.[0]

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-4">
      <div className="w-full max-w-[640px] rounded-[14px] shadow-[0_4px_12px_rgba(0,0,0,0.08)] bg-white flex flex-col overflow-hidden">

        <div className="flex items-center px-5 pt-5">
          <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-full px-2.5 py-0.5">
            {CARD_TYPE_LABEL[card.cardType] ?? card.cardType}
          </span>
        </div>

        <div className="flex flex-col items-center px-12 pt-8 pb-8">
          <p lang="ja" className="text-3xl font-japanese font-medium text-center text-neutral-900">
            {word}
          </p>

          {!showAnswer && (
            <div className="mt-8 flex flex-col items-center gap-1.5">
              <button
                onClick={flipCard}
                className="px-6 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-sm font-medium text-neutral-700 transition-colors"
              >
                Show Answer
              </button>
              <span className="text-xs text-neutral-400">or press Space</span>
            </div>
          )}
        </div>

        {showAnswer && (
          <div className="animate-card-reveal flex flex-col gap-4 px-12 pb-10 border-t border-neutral-100 pt-6">
            {reading !== null && reading !== '' && (
              <FuriganaText
                text={word}
                reading={reading}
                className="text-xl font-japanese"
              />
            )}

            <p className="text-base text-neutral-700">{meaning}</p>

            {firstSentence !== undefined && (
              <div className="rounded-lg bg-neutral-50 p-4 flex flex-col gap-1">
                <FuriganaText
                  text={firstSentence.ja}
                  reading={firstSentence.furigana}
                  className="text-sm font-japanese text-neutral-800"
                />
                <p className="text-sm text-neutral-500">{firstSentence.en}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showAnswer && <RatingButtons onRate={submitRating} />}
    </div>
  )
}
