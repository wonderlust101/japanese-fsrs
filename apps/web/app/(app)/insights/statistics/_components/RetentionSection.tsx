'use client'

import { useRef, useState } from 'react'

import { SectionCard } from '@/components/ui/SectionCard'
import { cn } from '@/lib/utils'

import { AnswerButtonDistribution } from './AnswerButtonDistribution'
import { ModuleError } from '@/components/ui/ModuleError'
import { RetentionLongCurve } from './RetentionLongCurve'
import { STATISTICS_SECTIONS_BY_ID } from './sections'
import { StatisticsSection } from './StatisticsSection'
import type { ActivityDay, AnswerButtonDistribution as Distribution } from './types'

interface RetentionSectionProps {
  days:           ReadonlyArray<ActivityDay>
  answers:        Distribution
  answersError?:  boolean
  onRetryAnswers?: () => void
}

type RetentionWindow = 30 | 90 | 365
const WINDOW_OPTIONS: ReadonlyArray<RetentionWindow> = [30, 90, 365]

const TAB_ID   = (opt: RetentionWindow): string => `retention-window-tab-${opt}`
const PANEL_ID = 'retention-window-panel'

const SECTION = STATISTICS_SECTIONS_BY_ID.retention

export function RetentionSection({
  days,
  answers,
  answersError = false,
  onRetryAnswers,
}: RetentionSectionProps): React.JSX.Element {
  const [windowDays, setWindowDays] = useState<RetentionWindow>(90)

  return (
    <StatisticsSection
      section={SECTION}
      rightSlot={<WindowTabs value={windowDays} onChange={setWindowDays} />}
    >
      <div className="flex flex-col gap-y-6 lg:gap-y-6">
        <SectionCard kanji="線" label="Retention curve">
          <div
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={TAB_ID(windowDays)}
            tabIndex={0}
            className="rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            <RetentionLongCurve days={days} windowDays={windowDays} />
          </div>
        </SectionCard>
        <SectionCard
          kanji="答"
          label="Answer button distribution"
          description="How often you reach for each rating during reviews. Colors match the rating buttons you use during practice."
        >
          {answersError
            ? <ModuleError label="the answer distribution" onRetry={onRetryAnswers ?? (() => {})} />
            : <AnswerButtonDistribution data={answers} />}
        </SectionCard>
      </div>
    </StatisticsSection>
  )
}

/**
 * Window selector implementing the WAI-ARIA tabs pattern: a single tab
 * stop (roving tabindex), Arrow/Home/End move focus and selection, and
 * each tab points at the retention-curve panel via aria-controls.
 */
function WindowTabs({
  value,
  onChange,
}: {
  value:    RetentionWindow
  onChange: (next: RetentionWindow) => void
}): React.JSX.Element {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusTab = (index: number): void => {
    const clamped = (index + WINDOW_OPTIONS.length) % WINDOW_OPTIONS.length
    const opt = WINDOW_OPTIONS[clamped]
    if (opt === undefined) return
    onChange(opt)
    tabRefs.current[clamped]?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number): void => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        focusTab(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        focusTab(index - 1)
        break
      case 'Home':
        e.preventDefault()
        focusTab(0)
        break
      case 'End':
        e.preventDefault()
        focusTab(WINDOW_OPTIONS.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Retention window"
      className="inline-flex items-center gap-x-1 rounded-[2px] border border-soft-hairline bg-cream-inset/40 p-0.5"
    >
      {WINDOW_OPTIONS.map((opt, i) => {
        const active = opt === value
        return (
          <button
            key={opt}
            ref={(el) => { tabRefs.current[i] = el }}
            type="button"
            role="tab"
            id={TAB_ID(opt)}
            aria-selected={active}
            aria-controls={PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[2px] px-3',
              'font-mono text-sm transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              active
                ? 'bg-vermillion-wash text-inari-vermillion-deep'
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
