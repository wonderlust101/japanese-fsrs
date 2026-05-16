'use client'

import { useAnalyticsDashboard } from '@/lib/api/analytics'

import { InsightsSiblingBody } from '../../_components/InsightsSiblingBody'
import { JLPTProgressBars } from '../../_components/JLPTProgressBars'
import { TodayProgressCard } from '../../_components/TodayProgressCard'

export function ProgressView(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const heatmap    = dashboard.data?.heatmap.items    ?? []
  const jlptGap    = dashboard.data?.jlptGap.items    ?? []
  const milestones = dashboard.data?.milestones.items ?? []
  const isLoading  = dashboard.isLoading

  return (
    <InsightsSiblingBody
      title="Progress"
      description="What you've moved through this week, where you stand against each JLPT level, and how the pace projects out."
      futureNote="Mature-cards graph and retention timeline arrive in a later pass."
    >
      <TodayProgressCard heatmap={[...heatmap]} isLoading={isLoading} />
      <JLPTProgressBars gap={[...jlptGap]} milestones={[...milestones]} isLoading={isLoading} />
    </InsightsSiblingBody>
  )
}
