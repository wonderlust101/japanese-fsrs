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
  return ONBOARDING_STEPS.find((s) => pathname.startsWith(s)) ?? null
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
      <span className="text-base font-semibold text-sumi-ink tracking-tight select-none">
        友<span className="text-inari-vermillion">日</span>
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
                  i < stepIndex  ? 'bg-inari-vermillion' :
                  i === stepIndex ? 'bg-inari-vermillion' :
                                    'bg-soft-hairline',
                ].join(' ')}
              />
            ))}
          </div>
          <span
            className="text-sm text-faded-sumi tabular-nums"
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
          className="text-sm text-faded-sumi hover:text-faded-sumi transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inari-vermillion
                     rounded-md px-2 py-1"
        >
          Skip →
        </button>
      )}
    </header>
  )
}
