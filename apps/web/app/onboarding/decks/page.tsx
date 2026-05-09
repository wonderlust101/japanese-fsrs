'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import type { UpdateProfileInput } from '@fsrs-japanese/shared-types'
import { RecommendedDeckCard } from '@/components/ui/RecommendedDeckCard'
import { DeckSummary } from '@/components/srs/DeckSummary'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { updateProfileAction } from '@/lib/actions/profile.actions'
import { StepCard, StepChild } from '../_components/step-card'
import { StepFooter } from '../_components/step-footer'

const SCHEDULE_TO_CARD_LIMIT: Record<string, number> = {
  light:     5,
  steady:    20,
  intensive: 50,
}

type LevelTone = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond' | 'kana'

interface RecommendedDeck {
  id:          string
  name:        string
  description: string
  level:       LevelTone
  levelLabel:  string
  count:       number
}

// Hardcoded placeholder. Real recommendations are blocked on the
// /onboarding/recommendations endpoint — tracked separately.
const RECOMMENDED_DECKS: ReadonlyArray<RecommendedDeck> = [
  { id: 'core-n5',         name: 'Core N5 Vocabulary',  description: 'Essential beginner vocab',          level: 'N5',   levelLabel: 'N5',   count: 800 },
  { id: 'jlpt-n5-grammar', name: 'JLPT N5 Grammar',     description: 'Foundational grammar patterns',     level: 'N5',   levelLabel: 'N5',   count: 64 },
  { id: 'kana',            name: 'Hiragana and Katakana', description: 'Both syllabaries with audio',     level: 'kana', levelLabel: 'Kana', count: 92 },
]

export default function DecksPage(): React.JSX.Element {
  const router           = useRouter()
  const schedule         = useOnboardingStore((s) => s.schedule)
  const applyAllDefaults = useOnboardingStore((s) => s.actions.applyAllDefaults)
  const reset            = useOnboardingStore((s) => s.actions.reset)

  // Default-none: the user picks; nothing is pre-decided.
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(
    () => new Set<string>(),
  )
  const subscribedCount = subscribedIds.size

  const totalCards = useMemo(
    () => RECOMMENDED_DECKS.filter((d) => subscribedIds.has(d.id)).reduce((sum, d) => sum + d.count, 0),
    [subscribedIds],
  )

  const paceNewPerDay = SCHEDULE_TO_CARD_LIMIT[schedule ?? 'steady'] ?? 20

  function toggleSubscribed(id: string): void {
    setSubscribedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: UpdateProfileInput) => updateProfileAction(payload),
    onSuccess: () => {
      reset()
      router.push('/dashboard')
    },
  })

  const isSkipping = subscribedCount === 0

  function handleContinue(): void {
    if (isSkipping) {
      // Skip the deck commitment, go straight to the dashboard. Matches
      // the prior escape-link behavior: profile mutation is reserved for
      // the explicit "Add and begin" path so unfinished onboardings don't
      // land partial answers on the server.
      router.push('/dashboard')
      return
    }

    applyAllDefaults()
    const { level, goal, interests, schedule: pace } = useOnboardingStore.getState()

    const payload: UpdateProfileInput = {
      jlptTarget:         level === 'beginner' || level === null ? 'N5' : level,
      ...(goal !== null ? { studyGoal: goal } : {}),
      interests,
      dailyNewCardsLimit: SCHEDULE_TO_CARD_LIMIT[pace ?? 'steady'] ?? 20,
    }
    mutate(payload)
  }

  return (
    <StepCard
      previewPane={
        <DeckSummary
          allDecks={RECOMMENDED_DECKS}
          subscribedIds={subscribedIds}
          paceNewPerDay={paceNewPerDay}
        />
      }
      heading="Your starter cards"
      subhead="Based on your answers. The summary updates as you toggle decks on or off."
      footer={
        <div className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm text-error">
              {error.message ?? 'Something went wrong. Please try again.'}
            </p>
          )}

          <StepFooter
            showBack
            isSkipping={isSkipping}
            continueLabel={isSkipping ? "I'll browse decks myself" : 'Add and begin'}
            continueLoading={isPending}
            onContinue={handleContinue}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {RECOMMENDED_DECKS.map((deck) => (
          <StepChild key={deck.id}>
            <RecommendedDeckCard
              name={deck.name}
              description={deck.description}
              level={deck.level}
              levelLabel={deck.levelLabel}
              count={deck.count}
              subscribed={subscribedIds.has(deck.id)}
              onToggle={() => toggleSubscribed(deck.id)}
            />
          </StepChild>
        ))}

        <StepChild>
          <div className="flex items-center justify-between gap-4 pt-3 mt-1 border-t border-soft-hairline">
            <p className="text-xs uppercase tracking-[0.08em] text-faded-sumi font-medium">
              {subscribedCount} {subscribedCount === 1 ? 'deck' : 'decks'} selected
            </p>
            <p className="text-xs text-faded-sumi font-mono tabular-nums">
              {totalCards.toLocaleString()} cards
            </p>
          </div>
        </StepChild>
      </div>
    </StepCard>
  )
}
