'use client'

import { useState } from 'react'

import { SectionCard } from '@/components/ui/SectionCard'
import { cn } from '@/lib/utils'

import { AnswerButtonDistribution } from './AnswerButtonDistribution'
import { RetentionLongCurve } from './RetentionLongCurve'
import { STATISTICS_SECTIONS_BY_ID } from './sections'
import { StatisticsSection } from './StatisticsSection'
import type { ActivityDay, AnswerButtonDistribution as Distribution } from './types'

interface RetentionSectionProps {
  days:    ReadonlyArray<ActivityDay>
  answers: Distribution
}

type RetentionWindow = 30 | 90 | 365
const WINDOW_OPTIONS: ReadonlyArray<RetentionWindow> = [30, 90, 365]

const SECTION = STATISTICS_SECTIONS_BY_ID.retention

export function RetentionSection({
  days,
  answers,
}: RetentionSectionProps): React.JSX.Element {
  const [windowDays, setWindowDays] = useState<RetentionWindow>(90)

  return (
    <StatisticsSection
      section={SECTION}
      rightSlot={<WindowTabs value={windowDays} onChange={setWindowDays} />}
    >
      <div className="flex flex-col gap-y-6 lg:gap-y-7">
        <SectionCard kanji="保" label="Retention curve">
          <RetentionLongCurve days={days} windowDays={windowDays} />
        </SectionCard>
        <SectionCard
          kanji="答"
          label="Answer button distribution"
          description="How often you reach for each rating during reviews. Colors match the rating buttons you use during practice."
        >
          <AnswerButtonDistribution data={answers} />
        </SectionCard>
      </div>
    </StatisticsSection>
  )
}

function WindowTabs({
  value,
  onChange,
}: {
  value:    RetentionWindow
  onChange: (next: RetentionWindow) => void
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Retention window"
      className="inline-flex items-center gap-x-1 rounded-[2px] border border-soft-hairline bg-cream-inset/60 p-0.5"
    >
      {WINDOW_OPTIONS.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={cn(
              'inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-[2px] px-2',
              'font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              active
                ? 'bg-inari-vermillion text-warm-paper-raised'
                : 'text-faded-sumi hover:text-sumi-ink',
            )}
          >
            {opt}d
          </button>
        )
      })}
    </div>
  )
}
