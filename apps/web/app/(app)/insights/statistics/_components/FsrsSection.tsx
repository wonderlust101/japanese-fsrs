import { SectionCard } from '@/components/ui/SectionCard'

import { DesiredRetentionDial } from './DesiredRetentionDial'
import { FsrsHistogram } from './FsrsHistogram'
import { RetentionComparison } from './RetentionComparison'
import { STATISTICS_SECTIONS_BY_ID } from './sections'
import { StatisticsSection } from './StatisticsSection'
import type { FsrsState } from './types'

interface FsrsSectionProps {
  fsrs: FsrsState
}

const SECTION = STATISTICS_SECTIONS_BY_ID.fsrs

/**
 * FSRS section. Four visualizations, each with a one-sentence plain-
 * English caption (per IA's `plain-language descriptions` requirement):
 *
 *   1. Desired-retention dial (target vs actual)
 *   2. Retention comparison (paired bars + delta)
 *   3. Stability distribution (how durable cards are)
 *   4. Difficulty distribution (how hard cards feel)
 */
export function FsrsSection({ fsrs }: FsrsSectionProps): React.JSX.Element {
  return (
    <StatisticsSection section={SECTION}>
      <div className="flex flex-col gap-y-6 lg:gap-y-7">
        {/* Top: Dial + comparison side by side on lg+ */}
        <SectionCard
          kanji="算"
          label="Retention target"
          description="The retention rate FSRS is scheduling for, alongside what your reviews actually show."
        >
          <div className="grid grid-cols-1 items-center gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <DesiredRetentionDial
              desired={fsrs.desiredRetention}
              actual={fsrs.trueRetention}
            />
            <RetentionComparison
              desired={fsrs.desiredRetention}
              actual={fsrs.trueRetention}
            />
          </div>
        </SectionCard>

        <SectionCard
          kanji="強"
          label="Stability distribution"
          description="How durably your cards stick. Longer-stability cards need fewer reviews to keep retained."
        >
          <FsrsHistogram
            buckets={fsrs.stability}
            ariaLabel={`Stability distribution across ${fsrs.stability.length} buckets.`}
          />
        </SectionCard>

        <SectionCard
          kanji="難"
          label="Difficulty distribution"
          description="How hard your cards feel to recall. Higher difficulty means FSRS expects more lapses."
        >
          <FsrsHistogram
            buckets={fsrs.difficulty}
            ariaLabel={`Difficulty distribution across ${fsrs.difficulty.length} buckets.`}
          />
        </SectionCard>
      </div>
    </StatisticsSection>
  )
}
