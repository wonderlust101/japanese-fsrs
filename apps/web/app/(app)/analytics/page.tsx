import type { Metadata } from 'next'

import { AnalyticsDashboard } from './_components/AnalyticsDashboard'

export const metadata: Metadata = { title: 'Analytics' }

export default function AnalyticsPage(): React.JSX.Element {
  return <AnalyticsDashboard />
}
