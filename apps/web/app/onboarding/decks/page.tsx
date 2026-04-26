'use client'

import { useRouter } from 'next/navigation'
import { useOnboardingStore } from '@/stores/onboarding.store'

export default function DecksPage() {
  const router           = useRouter()
  const applyAllDefaults = useOnboardingStore((s) => s.actions.applyAllDefaults)
  const reset            = useOnboardingStore((s) => s.actions.reset)

  function handleAddAndStart() {
    // Fill any unanswered steps with their sensible defaults before submitting.
    applyAllDefaults()

    // TODO: POST /api/v1/profile/onboarding with the store's answers, then
    // subscribe the user to the recommended deck IDs.
    // profile fields mapped from store:
    //   level ('beginner' | 'N5'…'N1') → jlpt_target (jlpt_level enum):
    //     'beginner' → 'N5'  (no 'beginner' in the DB enum)
    //     all others map 1-to-1
    //   goal → study_goal (free text)
    //   interests → interests (TEXT[])
    //   schedule → daily_new_cards_limit:
    //     'light'     → 5
    //     'steady'    → 20   (matches DB DEFAULT 20 per TDD §4.1)
    //     'intensive' → 50
    //   daily_review_limit and retention_target use their DB defaults (200, 0.85)
    //
    // reset() must only be called here AFTER that API call succeeds, so the
    // data isn't lost on a network error.
    reset()

    router.push('/dashboard')
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
        <button
          type="button"
          onClick={handleAddAndStart}
          className="h-12 px-8 rounded-[var(--radius-md)] bg-primary-500 text-white text-[15px]
                     font-medium transition-colors hover:bg-primary-600 active:scale-[0.98]
                     focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200"
        >
          Add all and start learning →
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-[13px] text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          Skip for now — I'll browse decks myself
        </button>
      </div>
    </div>
  )
}
