'use client'

import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'
import { RetentionHeatmap }  from './RetentionHeatmap'
import { AccuracyBreakdown } from './AccuracyBreakdown'
import { TodayProgressCard } from './TodayProgressCard'
import { ReviewForecastChart } from './ReviewForecastChart'
import { JLPTProgressBars }  from './JLPTProgressBars'

export function AnalyticsDashboard(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const forecast  = useReviewForecast()

  const heatmap    = dashboard.data?.heatmap.items    ?? []
  const accuracy   = dashboard.data?.accuracy.items   ?? []
  const jlptGap    = dashboard.data?.jlptGap.items    ?? []
  const milestones = dashboard.data?.milestones.items ?? []
  const isLoading  = dashboard.isLoading

  return (
    <div className="space-y-6">
      {/* Top stat row — today's progress sits alone (StreakCard was removed
          in Stage 8 when the legacy streak surface was retired end-to-end). */}
      <div className="grid grid-cols-1 gap-3">
        <TodayProgressCard
          heatmap={heatmap}
          isLoading={isLoading}
        />
      </div>

      {/* Heatmap */}
      <RetentionHeatmap data={heatmap} isLoading={isLoading} />

      {/* Review forecast */}
      <ReviewForecastChart data={forecast.data?.items ?? []} isLoading={forecast.isLoading} />

      {/* JLPT gap + milestone forecast (merged per row) */}
      <JLPTProgressBars
        gap={jlptGap}
        milestones={milestones}
        isLoading={isLoading}
      />

      {/* Accuracy by layout */}
      <AccuracyBreakdown data={accuracy} isLoading={isLoading} />
    </div>
  )
}
