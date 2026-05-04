import { TopBar } from '../_components/top-bar'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <TopBar>
        <h1 className="text-md font-semibold text-neutral-900">Analytics</h1>
      </TopBar>

      <div className="p-4 lg:p-6 max-w-[960px] mx-auto space-y-6">
        {children}
      </div>
    </>
  )
}
