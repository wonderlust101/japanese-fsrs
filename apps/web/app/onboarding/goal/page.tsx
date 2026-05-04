'use client'

import { useRouter } from 'next/navigation'
import { NEXT_STEP, useOnboardingStore, type OnboardingGoal } from '@/stores/onboarding.store'

const STEP_PATH = '/onboarding/goal' as const

interface GoalOption {
  value: OnboardingGoal
  emoji: string
  label: string
  description: string
}

const OPTIONS: GoalOption[] = [
  { value: 'jlpt',       emoji: '🎯', label: 'Pass JLPT',              description: 'Structured exam preparation' },
  { value: 'anime_manga',emoji: '🎌', label: 'Enjoy anime & manga',     description: 'Real content, natural Japanese' },
  { value: 'novels',     emoji: '📖', label: 'Read novels',             description: 'Literary vocabulary & grammar' },
  { value: 'life_work',  emoji: '🏢', label: 'Live / work in Japan',    description: 'Practical, everyday Japanese' },
]

export default function GoalPage(): React.JSX.Element {
  const router  = useRouter()
  const goal    = useOnboardingStore((s) => s.goal)
  const setGoal = useOnboardingStore((s) => s.actions.setGoal)

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900 leading-tight">
          What's your main goal?
        </h1>
        <p className="mt-2 text-base text-neutral-500">
          Your goal shapes which vocabulary and grammar patterns we surface first.
        </p>
      </div>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setGoal(opt.value)}
            aria-pressed={goal === opt.value}
            className={[
              'text-left p-5 rounded-[var(--radius-lg)] border-2 transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200',
              goal === opt.value
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
        onClick={() => router.push(NEXT_STEP[STEP_PATH])}
        disabled={goal === null}
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
