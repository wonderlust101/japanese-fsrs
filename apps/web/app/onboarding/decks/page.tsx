'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UpdateProfileInput } from '@fsrs-japanese/shared-types'
import { useOnboardingStore } from '@/stores/onboarding.store'

const SCHEDULE_TO_CARD_LIMIT: Record<string, number> = {
  light:     5,
  steady:    20,
  intensive: 50,
}

export default function DecksPage() {
  const router           = useRouter()
  const applyAllDefaults = useOnboardingStore((s) => s.actions.applyAllDefaults)
  const reset            = useOnboardingStore((s) => s.actions.reset)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleAddAndStart() {
    setLoading(true)
    setError(null)

    // Fill any unanswered steps with sensible defaults before building the payload.
    applyAllDefaults()

    // Read the fully-defaulted state in one snapshot.
    const { level, goal, interests, schedule } = useOnboardingStore.getState()

    // Map store values to the PATCH /api/v1/profile wire format.
    // 'beginner' has no DB equivalent — it maps to the lowest JLPT level.
    // Conditional spread for study_goal: exactOptionalPropertyTypes requires
    // the key to be absent rather than set to undefined.
    const payload: UpdateProfileInput = {
      jlpt_target:           (level === 'beginner' || level === null) ? 'N5' : level,
      ...(goal !== null ? { study_goal: goal } : {}),
      interests,
      daily_new_cards_limit: SCHEDULE_TO_CARD_LIMIT[schedule ?? 'steady'] ?? 20,
    }

    try {
      // TODO: await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/profile`, {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer <token>` },
      //   body: JSON.stringify(payload),
      // })
      void payload // remove once the fetch above is wired up

      // reset() is intentionally inside the try block — data must not be lost
      // on a network error.
      reset()
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div>
        <h1 className="text-[24px] font-semibold text-neutral-900 leading-tight">
          Your recommended decks
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          Based on your answers, we've chosen a few decks to get you started.
          You can swap or add more anytime from the Deck Library.
        </p>
      </div>

      {/* Placeholder deck cards — will be API-driven once /onboarding endpoint exists */}
      <div className="w-full flex flex-col gap-3">
        {[
          { name: 'Core N5 Vocabulary', count: 800,  badge: 'N5',  desc: 'Essential beginner vocab' },
          { name: 'JLPT N5 Grammar',    count: 64,   badge: 'N5',  desc: 'Foundational grammar patterns' },
          { name: 'Hiragana & Katakana', count: 92,  badge: 'Kana',desc: 'Both syllabaries with audio' },
        ].map((deck) => (
          <div
            key={deck.name}
            className="flex items-center justify-between px-5 py-4 rounded-[var(--radius-lg)]
                       bg-white border border-neutral-200 shadow-[var(--shadow-card)]"
          >
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[var(--radius-sm)]
                                 bg-success-100 text-success-700">
                  {deck.badge}
                </span>
                <p className="text-[15px] font-medium text-neutral-900">{deck.name}</p>
              </div>
              <p className="mt-0.5 text-[13px] text-neutral-500">{deck.desc}</p>
            </div>
            <p className="shrink-0 ml-4 text-[13px] text-neutral-400 tabular-nums">
              {deck.count} cards
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 w-full">
        {error && (
          <p role="alert" className="text-xs text-danger-500">{error}</p>
        )}

        <button
          type="button"
          onClick={handleAddAndStart}
          disabled={loading}
          className="h-12 px-8 rounded-[var(--radius-md)] bg-primary-500 text-white text-[15px]
                     font-medium transition-colors hover:bg-primary-600 active:scale-[0.98]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200"
        >
          {loading ? 'Saving…' : 'Add all and start learning →'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          disabled={loading}
          className="text-[13px] text-neutral-400 hover:text-neutral-600 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Skip for now — I&apos;ll browse decks myself
        </button>
      </div>
    </div>
  )
}
