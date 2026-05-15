import { StubPage } from '../../_components/StubPage'

export default function InsightsForecastPage(): React.JSX.Element {
  return (
    <StubPage
      title="Insights — Forecast"
      links={[
        { href: '/insights',     label: 'Insights overview' },
        { href: '/review/setup', label: 'Review setup' },
      ]}
    />
  )
}
