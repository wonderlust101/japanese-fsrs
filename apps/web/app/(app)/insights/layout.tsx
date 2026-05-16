import { TopBar } from '../_components/top-bar'

import { InsightsTabs } from './_components/InsightsTabs'

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <TopBar>
        <h1 className="text-md font-semibold text-sumi-ink">Insights</h1>
      </TopBar>

      <div className="mx-auto max-w-[1024px] px-4 py-6 lg:px-8 lg:py-8">
        <header className="mb-6 lg:mb-8">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
            Insights
          </p>
          <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-faded-sumi">
            A teacher&rsquo;s read on the week: what progress, what to attend to,
            what&rsquo;s coming.
          </p>
          <div className="mt-5">
            <InsightsTabs />
          </div>
        </header>
        {children}
      </div>
    </>
  )
}
