'use client'

import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'

import { AccuracyBreakdown } from '../../_components/AccuracyBreakdown'
import { InsightsSiblingBody } from '../../_components/InsightsSiblingBody'
import { JLPTProgressBars } from '../../_components/JLPTProgressBars'
import { RetentionHeatmap } from '../../_components/RetentionHeatmap'
import { ReviewForecastChart } from '../../_components/ReviewForecastChart'
import { TodayProgressCard } from '../../_components/TodayProgressCard'

export function StatisticsView(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const forecast  = useReviewForecast()
  const heatmap    = dashboard.data?.heatmap.items    ?? []
  const accuracy   = dashboard.data?.accuracy.items   ?? []
  const jlptGap    = dashboard.data?.jlptGap.items    ?? []
  const milestones = dashboard.data?.milestones.items ?? []
  const isLoading  = dashboard.isLoading

  return (
    <InsightsSiblingBody
      title="Statistics"
      description="The raw numbers, all in one place. Useful when you want the underlying data without the interpretation."
    >
      <TodayProgressCard heatmap={[...heatmap]} isLoading={isLoading} />
      <RetentionHeatmap data={[...heatmap]} isLoading={isLoading} />
      <ReviewForecastChart data={forecast.data?.items ?? []} isLoading={forecast.isLoading} />
      <JLPTProgressBars gap={[...jlptGap]} milestones={[...milestones]} isLoading={isLoading} />
      <AccuracyBreakdown data={[...accuracy]} isLoading={isLoading} />
    </InsightsSiblingBody>
  )
}
