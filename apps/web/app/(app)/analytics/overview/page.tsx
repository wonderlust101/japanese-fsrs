'use client'

import { RetentionHeatmap }  from '../_components/RetentionHeatmap'
import { AccuracyBreakdown } from '../_components/AccuracyBreakdown'
import { useHeatmapData, useAccuracyByLayout } from '@/lib/api/analytics'

export default function AnalyticsOverviewPage() {
  const { data: heatmap  = [], isLoading: heatmapLoading  } = useHeatmapData()
  const { data: accuracy = [], isLoading: accuracyLoading } = useAccuracyByLayout()

  return (
    <div className="space-y-6">
      <RetentionHeatmap
        data={heatmap}
        isLoading={heatmapLoading}
      />
      <AccuracyBreakdown
        data={accuracy}
        isLoading={accuracyLoading}
      />
    </div>
  )
}
