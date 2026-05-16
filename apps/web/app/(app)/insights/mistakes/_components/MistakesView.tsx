'use client'

import { useAnalyticsDashboard } from '@/lib/api/analytics'

import { AccuracyBreakdown } from '../../_components/AccuracyBreakdown'
import { InsightsSiblingBody } from '../../_components/InsightsSiblingBody'

export function MistakesView(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const items = dashboard.data?.accuracy.items ?? []

  return (
    <InsightsSiblingBody
      title="Mistakes"
      description="Where you're slipping, broken down by card layout. A pattern here is more useful than a single bad day."
      futureNote="Per-card mistake history is coming in a later pass."
    >
      <AccuracyBreakdown data={[...items]} isLoading={dashboard.isLoading} />
    </InsightsSiblingBody>
  )
}
