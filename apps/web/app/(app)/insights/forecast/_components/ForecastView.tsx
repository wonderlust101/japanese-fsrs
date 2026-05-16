'use client'

import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'

import { InsightsSiblingBody } from '../../_components/InsightsSiblingBody'
import { RetentionHeatmap } from '../../_components/RetentionHeatmap'
import { ReviewForecastChart } from '../../_components/ReviewForecastChart'

export function ForecastView(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const forecast  = useReviewForecast()
  const heatmap   = dashboard.data?.heatmap.items ?? []

  return (
    <InsightsSiblingBody
      title="Forecast"
      description="What's coming over the next two weeks, alongside your retention pattern from the last twelve."
      futureNote="Per-deck forecast filtering arrives in a later pass."
    >
      <ReviewForecastChart data={forecast.data?.items ?? []} isLoading={forecast.isLoading} />
      <RetentionHeatmap data={[...heatmap]} isLoading={dashboard.isLoading} />
    </InsightsSiblingBody>
  )
}
