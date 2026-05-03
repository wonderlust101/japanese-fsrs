import { TopBar } from '../_components/top-bar'
import { AnalyticsTabs } from './_components/AnalyticsTabs'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar>
        <h1 className="text-md font-semibold text-neutral-900">Analytics</h1>
      </TopBar>

      <div className="p-4 lg:p-6 max-w-[960px] mx-auto space-y-6">
        <AnalyticsTabs />
        {children}
      </div>
    </>
  )
}
