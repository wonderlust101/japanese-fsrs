'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  NEXT_STEP,
  ONBOARDING_STEP_INDEX,
  ONBOARDING_STEPS,
  useOnboardingStore,
  type OnboardingStepPath,
} from '@/stores/onboarding.store'

function resolveStep(pathname: string): OnboardingStepPath | null {
  return (
    (ONBOARDING_STEPS.find((s) => pathname.startsWith(s)) as OnboardingStepPath | undefined) ??
    null
  )
}

export function OnboardingHeader(): React.JSX.Element {
  const pathname  = usePathname()
  const router    = useRouter()
  const applyStepDefault = useOnboardingStore((s) => s.actions.applyStepDefault)

  const step      = resolveStep(pathname)
  const stepIndex = step !== null ? ONBOARDING_STEP_INDEX[step] : -1
  const total     = ONBOARDING_STEPS.length
  const isWelcome = step === null

  function handleSkip() {
    if (step === null) return
    applyStepDefault(step)
    router.push(NEXT_STEP[step])
  }

  return (
    <header className="w-full px-6 py-5 flex items-center justify-between">
      {/* Logo */}
      <span className="text-base font-semibold text-neutral-700 tracking-tight select-none">
        友<span className="text-primary-500">日</span>
      </span>

      {/* Step indicator — hidden on Welcome screen, visible on all 5 steps */}
      {isWelcome ? (
        <div aria-hidden="true" />
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {ONBOARDING_STEPS.map((_, i) => (
              <span
                key={i}
                className={[
                  'block w-2 h-2 rounded-full transition-colors duration-200',
                  i < stepIndex  ? 'bg-primary-300' :
                  i === stepIndex ? 'bg-primary-500' :
                                    'bg-neutral-300',
                ].join(' ')}
              />
            ))}
          </div>
          <span
            className="text-sm text-neutral-400 tabular-nums"
            aria-live="polite"
            aria-label={`Step ${stepIndex + 1} of ${total}`}
          >
            Step {stepIndex + 1} of {total}
          </span>
        </div>
      )}

      {/* Skip — hidden on Welcome screen; each numbered step exposes it */}
      {isWelcome ? (
        <div aria-hidden="true" />
      ) : (
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
                     rounded-md px-2 py-1"
        >
          Skip →
        </button>
      )}
    </header>
  )
}
