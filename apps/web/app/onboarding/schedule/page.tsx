'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { NEXT_STEP, useOnboardingStore, type OnboardingSchedule } from '@/stores/onboarding.store'
import { SelectionCard } from '@/components/ui/SelectionCard'
import { DailyQuotaChart } from '@/components/srs/DailyQuotaChart'
import { PaceIntensive, PaceLight, PaceSteady } from '@/components/icons/study-marks'
import { StepCard, StepChild } from '../_components/step-card'
import { StepFooter } from '../_components/step-footer'
import { useNumberKey } from '../_components/use-number-key'

const STEP_PATH = '/onboarding/schedule' as const

interface ScheduleOption {
  value:       OnboardingSchedule
  Icon:        React.ComponentType<{ className?: string }>
  label:       string
  time:        string
  newCards:    number
  description: string
}

const OPTIONS: ReadonlyArray<ScheduleOption> = [
  { value: 'light',     Icon: PaceLight,     label: 'Light',     time: '~5 min / day',     newCards: 5,  description: 'Casual, low pressure' },
  { value: 'steady',    Icon: PaceSteady,    label: 'Steady',    time: '~15 min / day',    newCards: 20, description: 'Consistent without burnout' },
  { value: 'intensive', Icon: PaceIntensive, label: 'Intensive', time: '~30 min+ / day',   newCards: 50, description: 'Fastest path to fluency' },
]

export default function SchedulePage(): React.JSX.Element {
  const router            = useRouter()
  const schedule          = useOnboardingStore((s) => s.schedule)
  const setSchedule       = useOnboardingStore((s) => s.actions.setSchedule)
  const applyStepDefault  = useOnboardingStore((s) => s.actions.applyStepDefault)

  const handleSelect = useCallback(
    (value: OnboardingSchedule) => {
      // Re-tapping the currently-selected card deselects it.
      setSchedule(schedule === value ? null : value)
    },
    [schedule, setSchedule],
  )

  const isSkipping = schedule === null

  const handleContinue = useCallback(() => {
    if (isSkipping) applyStepDefault(STEP_PATH)
    router.push(NEXT_STEP[STEP_PATH])
  }, [isSkipping, applyStepDefault, router])

  const handleNumberKey = useCallback(
    (i: number) => {
      const opt = OPTIONS[i]
      if (opt) handleSelect(opt.value)
    },
    [handleSelect],
  )
  useNumberKey(OPTIONS.length, handleNumberKey)

  return (
    <StepCard
      previewPane={<DailyQuotaChart pace={schedule} />}
      heading="How much Japanese this week?"
      subhead="Sets your daily new-card pace. The chart projects new cards plus reviews across a typical week."
      footer={
        <StepFooter
          showBack
          isSkipping={isSkipping}
          continueLabel={isSkipping ? 'Skip this step' : 'Continue'}
          onContinue={handleContinue}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {OPTIONS.map((opt) => (
          <StepChild key={opt.value}>
            <SelectionCard
              selected={schedule === opt.value}
              onSelect={() => handleSelect(opt.value)}
              layout="inline"
              glyph={<opt.Icon className="text-inari-vermillion-deep" />}
              label={opt.label}
              description={opt.description}
              trailing={
                <span className="flex flex-col items-end gap-0.5">
                  <span
                    className={[
                      'text-base font-mono font-medium tabular-nums',
                      schedule === opt.value ? 'text-inari-vermillion' : 'text-sumi-ink',
                    ].join(' ')}
                  >
                    {opt.time}
                  </span>
                  <span className="text-xs text-faded-sumi font-mono tabular-nums">
                    {opt.newCards} new / day
                  </span>
                </span>
              }
            />
          </StepChild>
        ))}
      </div>
    </StepCard>
  )
}
