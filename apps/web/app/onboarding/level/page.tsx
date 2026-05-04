'use client'

import { useRouter } from 'next/navigation'
import { NEXT_STEP, useOnboardingStore, type OnboardingLevel } from '@/stores/onboarding.store'

const STEP_PATH = '/onboarding/level' as const

interface LevelOption {
  value: OnboardingLevel
  emoji: string
  label: string
  description: string
}

const OPTIONS: LevelOption[] = [
  { value: 'beginner', emoji: '🌱', label: 'Complete Beginner', description: 'Starting from zero' },
  { value: 'N5',       emoji: '📘', label: 'JLPT N5',           description: 'Hiragana & basic vocab' },
  { value: 'N4',       emoji: '📗', label: 'JLPT N4',           description: '~1 year of study' },
  { value: 'N3',       emoji: '📙', label: 'JLPT N3',           description: 'Intermediate' },
  { value: 'N2',       emoji: '📕', label: 'JLPT N2',           description: 'Upper-intermediate' },
  { value: 'N1',       emoji: '📔', label: 'N1 or Beyond',      description: 'Advanced learner' },
]

export default function LevelPage(): React.JSX.Element {
  const router  = useRouter()
  const level   = useOnboardingStore((s) => s.level)
  const setLevel = useOnboardingStore((s) => s.actions.setLevel)

  function handleContinue() {
    router.push(NEXT_STEP[STEP_PATH])
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900 leading-tight">
          What's your current Japanese level?
        </h1>
        <p className="mt-2 text-base text-neutral-500">
          We'll suggest the right starting decks for you.
        </p>
      </div>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLevel(opt.value)}
            aria-pressed={level === opt.value}
            className={[
              'text-left p-5 rounded-[var(--radius-lg)] border-2 transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200',
              level === opt.value
                ? 'border-primary-500 bg-primary-50 shadow-[var(--shadow-card)]'
                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-[var(--shadow-card)]',
            ].join(' ')}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <p className="mt-2 font-medium text-neutral-900 text-base">{opt.label}</p>
            <p className="mt-0.5 text-sm text-neutral-500">{opt.description}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={level === null}
        className="h-12 px-8 rounded-[var(--radius-md)] bg-primary-500 text-white text-base
                   font-medium transition-colors hover:bg-primary-600 active:scale-[0.98]
                   disabled:opacity-40 disabled:cursor-not-allowed
                   focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200"
      >
        Continue →
      </button>
    </div>
  )
}
