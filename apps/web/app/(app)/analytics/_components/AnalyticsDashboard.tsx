'use client'

import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'
import { RetentionHeatmap }  from './RetentionHeatmap'
import { AccuracyBreakdown } from './AccuracyBreakdown'
import { StreakCard }        from './StreakCard'
import { TodayProgressCard } from './TodayProgressCard'
import { ReviewForecastChart } from './ReviewForecastChart'
import { JLPTProgressBars }  from './JLPTProgressBars'

export function AnalyticsDashboard(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const forecast  = useReviewForecast()

  const heatmap    = dashboard.data?.heatmap    ?? []
  const accuracy   = dashboard.data?.accuracy   ?? []
  const streak     = dashboard.data?.streak
  const jlptGap    = dashboard.data?.jlptGap    ?? []
  const milestones = dashboard.data?.milestones ?? []
  const isLoading  = dashboard.isLoading

  return (
    <div className="space-y-6">
      {/* Top stat row — what users come back for daily */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StreakCard
          currentStreak={streak?.currentStreak ?? 0}
          longestStreak={streak?.longestStreak ?? 0}
          isLoading={isLoading}
        />
        <TodayProgressCard
          heatmap={heatmap}
          isLoading={isLoading}
        />
      </div>

      {/* Heatmap */}
      <RetentionHeatmap data={heatmap} isLoading={isLoading} />

      {/* Review forecast */}
      <ReviewForecastChart data={forecast.data ?? []} isLoading={forecast.isLoading} />

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
