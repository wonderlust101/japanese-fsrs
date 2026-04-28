'use client'

import { useRouter } from 'next/navigation'
import { NEXT_STEP, useOnboardingStore, type OnboardingSchedule } from '@/stores/onboarding.store'

const STEP_PATH = '/onboarding/schedule' as const

interface ScheduleOption {
  value: OnboardingSchedule
  label: string
  time: string
  newCards: number
  description: string
}

const OPTIONS: ScheduleOption[] = [
  {
    value:       'light',
    label:       'Light',
    time:        '~5 min / day',
    newCards:    5,
    description: 'Casual review, low pressure',
  },
  {
    value:       'steady',
    label:       'Steady',
    time:        '~15 min / day',
    newCards:    20,
    description: 'Consistent progress without burnout',
  },
  {
    value:       'intensive',
    label:       'Intensive',
    time:        '~30 min+ / day',
    newCards:    50,
    description: 'Fastest path to fluency',
  },
]

export default function SchedulePage() {
  const router      = useRouter()
  const schedule    = useOnboardingStore((s) => s.schedule)
  const setSchedule = useOnboardingStore((s) => s.actions.setSchedule)

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900 leading-tight">
          How much time per day?
        </h1>
        <p className="mt-2 text-base text-neutral-500">
          Sets your daily new-card limit. You can always adjust this in Settings.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSchedule(opt.value)}
            aria-pressed={schedule === opt.value}
            className={[
              'flex items-center justify-between p-5 rounded-[var(--radius-lg)] border-2',
              'transition-all duration-150 text-left',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-200',
              schedule === opt.value
                ? 'border-primary-500 bg-primary-50 shadow-[var(--shadow-card)]'
                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-[var(--shadow-card)]',
            ].join(' ')}
          >
            <div>
              <p className="font-medium text-neutral-900 text-base">{opt.label}</p>
              <p className="mt-0.5 text-sm text-neutral-500">{opt.description}</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className={`text-base font-semibold ${schedule === opt.value ? 'text-primary-600' : 'text-neutral-700'}`}>
                {opt.time}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {opt.newCards} new cards/day
              </p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => router.push(NEXT_STEP[STEP_PATH])}
        disabled={schedule === null}
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
