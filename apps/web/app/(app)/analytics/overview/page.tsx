import { redirect } from 'next/navigation'

// Legacy URL — keep working by redirecting to the new unified dashboard.
export default function AnalyticsOverviewPage(): never {
  redirect('/analytics')
}
