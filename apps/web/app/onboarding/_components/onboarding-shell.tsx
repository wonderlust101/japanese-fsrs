'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
  ONBOARDING_STEP_INDEX,
  ONBOARDING_STEPS,
  type OnboardingStepPath,
} from '@/stores/onboarding.store'
import { CardStack } from '@/components/ui/CardStack'
import { Logo } from '@/components/ui/Logo'

// Welcome cover sits before the questionnaire. Treat it as index -1 so a
// welcome → step-1 transition reads as forward, and step-1 → welcome reads
// as backward.
function effectiveStepIndex(pathname: string): number {
  const match = ONBOARDING_STEPS.find((s) => pathname.startsWith(s)) as OnboardingStepPath | undefined
  return match !== undefined ? ONBOARDING_STEP_INDEX[match] : -1
}

/**
 * Persistent onboarding shell.
 *
 * Layout decomposes into three vertical regions:
 *   1. Editorial top bar — Logo + horizontal hairline rules. Brand presence
 *      only, no functional affordances.
 *   2. Step row — counter `02` + full-width bars + total `05`. Static; the
 *      values update synchronously when the route changes.
 *   3. Card area — the CardStack itself, which owns the page-turn transition
 *      between cards. Direction (forward / backward) is derived from the
 *      route change; the inner content cascade in StepCard remains untouched.
 */
export function OnboardingShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname()

  const stepIndex   = effectiveStepIndex(pathname)
  const totalSteps  = ONBOARDING_STEPS.length
  const isWelcome   = stepIndex === -1

  // Track the prior step index so CardStack can choose "lift" (forward) vs
  // "descend" (backward). Read-then-update via effect to keep the render
  // body pure: the ref reads the previous value during this render, then
  // commits the current value after paint.
  const prevIndexRef = useRef<number>(stepIndex)
  const direction: 'forward' | 'backward' =
    stepIndex >= prevIndexRef.current ? 'forward' : 'backward'
  useEffect(() => {
    prevIndexRef.current = stepIndex
  }, [stepIndex])

  // Onboarding shows up to 2 cards behind on the questionnaire steps. Welcome
  // shows 0 (it's the cover, no progression to depict). The deck depletes:
  // steps 01–03 show 2 behind, step 04 shows 1 behind, step 05 shows 0.
  const cardsBehind = isWelcome
    ? 0
    : Math.min(2, Math.max(0, totalSteps - stepIndex - 1))

  // Welcome stays narrow (a focused cover with the forgetting-curve hero).
  // Questionnaire steps run at 1080px — a measured middle ground between
  // the prior 860px (right column was ~430px wide; descriptions truncated)
  // and the app's 1440px canvas (questionnaire felt dashboard-wide). At
  // 1080px the StepCard's 38% / 1fr grid produces a ~380px preview pane
  // and a ~570px answer column — comfortable reading without sprawl.
  const cardWidthClass = isWelcome ? 'max-w-[760px]' : 'max-w-[1080px]'

  return (
    <div className="relative min-h-screen bg-cool-paper-base text-sumi-ink">
      {/* Editorial top bar: full-bleed masthead, absolutely positioned so it
          does not reserve vertical grid space. The card below centers in the
          full viewport rather than in "viewport minus header." Two subtle
          1px hairlines preserve the editorial-publication double-rule
          signature without shouting. */}
      <header className="absolute top-0 left-0 right-0 z-10 px-6 md:px-12 pt-8 md:pt-10 pb-7 md:pb-9">
        <div className="flex items-center gap-8">
          <Logo size={48} wordmarkSize="xl" />
          <div className="flex-1 flex flex-col gap-2" aria-hidden="true">
            <span className="block h-px bg-soft-hairline" />
            <span className="block h-px bg-soft-hairline" />
          </div>
        </div>
      </header>

      <main className="min-h-screen flex items-center justify-center px-6 md:px-12 py-12 md:py-16">
        <div className={`w-full ${cardWidthClass}`}>
          {/* Step indicator row. Layout: `[02 / 05]  ──── full-width bars ────`.
              Counter and total live together as a single chip on the left;
              bars fill the rest of the row.

              `key={pathname}` remounts the row on every step navigation,
              which replays the fade-up on the motion.div. The row's
              internal pieces (counter, bars) stay static — only the
              wrapper moves, so the row arrives as one element. */}
          {!isWelcome && (
            <div
              key={pathname}
              className="mb-4 px-1 flex items-center gap-4"
            >
              <p className="sr-only" aria-live="polite">
                Step {stepIndex + 1} of {totalSteps}
              </p>

              {/* Combined counter `02 / 05` on the left. Hairline-pale slash
                  reads as a muted divider; both digits sit in the same
                  faded-sumi color family so the chip feels unified. */}
              <p
                className="text-sm font-mono tabular-nums text-faded-sumi"
                aria-hidden="true"
              >
                {(stepIndex + 1).toString().padStart(2, '0')}
                <span className="text-soft-hairline mx-1.5">/</span>
                {totalSteps.toString().padStart(2, '0')}
              </p>

              {/* Bars fill remaining width. Past + current fill vermillion;
                  upcoming stay hairline-pale. */}
              <div className="flex-1 flex items-center gap-2" aria-hidden="true">
                {Array.from({ length: totalSteps }, (_, i) => {
                  const isFilled = i <= stepIndex
                  return (
                    <span
                      key={i}
                      className="block h-[3px] flex-1 rounded-[1px]"
                      style={{
                        backgroundColor: isFilled
                          ? 'var(--color-inari-vermillion)'
                          : 'var(--color-soft-hairline)',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )}

          <CardStack
            contentKey={pathname}
            cardsBehind={cardsBehind}
            direction={direction}
          >
            {children}
          </CardStack>
        </div>
      </main>
    </div>
  )
}
