'use client'

import { useRouter } from 'next/navigation'
import { NEXT_STEP, useOnboardingStore } from '@/stores/onboarding.store'

const STEP_PATH = '/onboarding/interests' as const

const INTEREST_OPTIONS = [
  { value: 'anime',    label: 'Anime',    emoji: '🎬' },
  { value: 'gaming',   label: 'Gaming',   emoji: '🎮' },
  { value: 'food',     label: 'Food',     emoji: '🍜' },
  { value: 'business', label: 'Business', emoji: '💼' },
  { value: 'travel',   label: 'Travel',   emoji: '✈️' },
  { value: 'music',    label: 'Music',    emoji: '🎵' },
  { value: 'sports',   label: 'Sports',   emoji: '⚽' },
  { value: 'tech',     label: 'Tech',     emoji: '💻' },
]

export default function InterestsPage(): React.JSX.Element {
  const router          = useRouter()
  const interests       = useOnboardingStore((s) => s.interests)
  const toggleInterest  = useOnboardingStore((s) => s.actions.toggleInterest)

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-sumi-ink leading-tight">
          What are your interests?
        </h1>
        <p className="mt-2 text-base text-faded-sumi">
          We'll pull example sentences from topics you actually care about.
          You can select multiple.
        </p>
      </div>

      {/* Chip grid */}
      <div
        className="w-full flex flex-wrap gap-3 justify-center"
        role="group"
        aria-label="Interest topics"
      >
        {INTEREST_OPTIONS.map((opt) => {
          const selected = interests.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleInterest(opt.value)}
              aria-pressed={selected}
              className={[
                'flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-full)]',
                'border-2 text-sm font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-vermillion-wash',
                selected
                  ? 'border-inari-vermillion bg-vermillion-wash text-inari-vermillion'
                  : 'border-soft-hairline bg-warm-paper-raised text-sumi-ink hover:border-soft-hairline',
              ].join(' ')}
            >
              <span aria-hidden="true">{opt.emoji}</span>
              {opt.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-2 w-full">
        <button
          type="button"
          onClick={() => router.push(NEXT_STEP[STEP_PATH])}
          className="h-12 px-8 rounded-[var(--radius-md)] bg-inari-vermillion text-warm-paper-raised text-base
                     font-medium transition-colors hover:bg-inari-vermillion-deep active:scale-[0.98]
                     focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-vermillion-wash"
        >
          Continue →
        </button>
        {interests.length === 0 && (
          <p className="text-sm text-faded-sumi">No selection is fine — we'll use general examples.</p>
        )}
      </div>
    </div>
  )
}
