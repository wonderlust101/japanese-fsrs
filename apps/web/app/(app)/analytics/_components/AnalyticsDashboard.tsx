'use client'

import {
  useHeatmapData,
  useAccuracyByLayout,
  useStreak,
  useJlptGap,
  useMilestoneForecast,
} from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'
import { RetentionHeatmap }  from './RetentionHeatmap'
import { AccuracyBreakdown } from './AccuracyBreakdown'
import { StreakCard }        from './StreakCard'
import { TodayProgressCard } from './TodayProgressCard'
import { ReviewForecastChart } from './ReviewForecastChart'
import { JLPTProgressBars }  from './JLPTProgressBars'

export function AnalyticsDashboard(): React.JSX.Element {
  const heatmap   = useHeatmapData()
  const accuracy  = useAccuracyByLayout()
  const streak    = useStreak()
  const jlptGap   = useJlptGap()
  const forecast  = useReviewForecast()
  const milestones = useMilestoneForecast()

  return (
    <div className="space-y-6">
      {/* Top stat row — what users come back for daily */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StreakCard
          currentStreak={streak.data?.currentStreak ?? 0}
          longestStreak={streak.data?.longestStreak ?? 0}
          isLoading={streak.isLoading}
        />
        <TodayProgressCard
          heatmap={heatmap.data ?? []}
          isLoading={heatmap.isLoading}
        />
      </div>

      {/* Heatmap */}
      <RetentionHeatmap data={heatmap.data ?? []} isLoading={heatmap.isLoading} />

      {/* Review forecast */}
      <ReviewForecastChart data={forecast.data ?? []} isLoading={forecast.isLoading} />

      {/* JLPT gap + milestone forecast (merged per row) */}
      <JLPTProgressBars
        gap={jlptGap.data ?? []}
        milestones={milestones.data ?? []}
        isLoading={jlptGap.isLoading || milestones.isLoading}
      />

      {/* Accuracy by layout */}
      <AccuracyBreakdown data={accuracy.data ?? []} isLoading={accuracy.isLoading} />
    </div>
  )
}
