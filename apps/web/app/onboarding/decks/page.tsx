'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import type { UpdateProfileInput } from '@fsrs-japanese/shared-types'
import { useOnboardingStore } from '@/stores/onboarding.store'
import { updateProfileAction } from '@/lib/actions/profile.actions'

const SCHEDULE_TO_CARD_LIMIT: Record<string, number> = {
  light:     5,
  steady:    20,
  intensive: 50,
}

export default function DecksPage(): React.JSX.Element {
  const router         = useRouter()
  const applyAllDefaults = useOnboardingStore((s) => s.actions.applyAllDefaults)
  const reset            = useOnboardingStore((s) => s.actions.reset)

  const { mutate, isPending, error } = useMutation({
    mutationFn: (payload: UpdateProfileInput) => updateProfileAction(payload),
    onSuccess: () => {
      reset()
      router.push('/dashboard')
    },
  })

  function handleAddAndStart() {
    applyAllDefaults()

    const { level, goal, interests, schedule } = useOnboardingStore.getState()

    const payload: UpdateProfileInput = {
      jlptTarget:         (level === 'beginner' || level === null) ? 'N5' : level,
      ...(goal !== null ? { studyGoal: goal } : {}),
      interests,
      dailyNewCardsLimit: SCHEDULE_TO_CARD_LIMIT[schedule ?? 'steady'] ?? 20,
    }

    mutate(payload)
  }

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <h1 className="text-xl font-semibold text-sumi-ink leading-tight">
          Your recommended decks
        </h1>
        <p className="mt-2 text-base text-faded-sumi">
          Based on your answers, we've chosen a few decks to get you started.
          You can swap or add more anytime from the Deck Library.
        </p>
      </div>

      {/* Placeholder deck cards — will be API-driven once /onboarding endpoint exists */}
      <div className="w-full flex flex-col gap-3">
        {[
          { name: 'Core N5 Vocabulary',  count: 800, badge: 'N5',   desc: 'Essential beginner vocab' },
          { name: 'JLPT N5 Grammar',     count: 64,  badge: 'N5',   desc: 'Foundational grammar patterns' },
          { name: 'Hiragana & Katakana', count: 92,  badge: 'Kana', desc: 'Both syllabaries with audio' },
        ].map((deck) => (
          <div
            key={deck.name}
            className="flex items-center justify-between px-5 py-4 rounded-[var(--radius-lg)]
                       bg-warm-paper-raised border border-soft-hairline shadow-[var(--shadow-card)]"
          >
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-[var(--radius-sm)]
                               bg-jlpt-n5-bg text-jlpt-n4-deep-emerald"
                >
                  {deck.badge}
                </span>
                <p className="text-base font-medium text-sumi-ink">{deck.name}</p>
              </div>
              <p className="mt-0.5 text-sm text-faded-sumi">{deck.desc}</p>
            </div>
            <p className="shrink-0 ml-4 text-sm text-faded-sumi tabular-nums">
              {deck.count} cards
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 w-full">
        {error && (
          <p role="alert" className="text-xs text-error">
            {error?.message ?? 'Unknown error'}
          </p>
        )}

        <button
          type="button"
          onClick={handleAddAndStart}
          disabled={isPending}
          className="h-12 px-8 rounded-[var(--radius-md)] bg-inari-vermillion text-warm-paper-raised text-base
                     font-medium transition-colors hover:bg-inari-vermillion-deep active:scale-[0.98]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-vermillion-wash"
        >
          {isPending ? 'Saving…' : 'Add all and start learning →'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          disabled={isPending}
          className="text-sm text-faded-sumi hover:text-faded-sumi transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Skip for now — I&apos;ll browse decks myself
        </button>
      </div>
    </div>
  )
}
