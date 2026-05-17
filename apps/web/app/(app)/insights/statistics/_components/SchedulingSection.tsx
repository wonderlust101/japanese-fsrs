import { SectionCard } from '@/components/ui/SectionCard'

import { CumulativeDueCurve } from './CumulativeDueCurve'
import { IntervalHistogram } from './IntervalHistogram'
import { OverdueImpactCallout } from './OverdueImpactCallout'
import { STATISTICS_SECTIONS_BY_ID } from './sections'
import { StatisticsSection } from './StatisticsSection'
import type { CumulativeDueDay, IntervalBucket, OverdueImpact } from './types'

interface SchedulingSectionProps {
  intervals:  ReadonlyArray<IntervalBucket>
  cumulative: ReadonlyArray<CumulativeDueDay>
  overdue:    OverdueImpact
}

const SECTION = STATISTICS_SECTIONS_BY_ID.scheduling

export function SchedulingSection({
  intervals,
  cumulative,
  overdue,
}: SchedulingSectionProps): React.JSX.Element {
  return (
    <StatisticsSection section={SECTION}>
      <div className="flex flex-col gap-y-6 lg:gap-y-7">
        <SectionCard
          kanji="間"
          label="Interval distribution"
          description="How your collection is spread across review-interval buckets."
        >
          <IntervalHistogram buckets={intervals} />
        </SectionCard>
        <SectionCard
          kanji="積"
          label="Cumulative due"
          description="Total cards becoming due as the next 90 days roll forward."
        >
          <CumulativeDueCurve data={cumulative} />
        </SectionCard>
        <OverdueImpactCallout data={overdue} />
      </div>
    </StatisticsSection>
  )
}
