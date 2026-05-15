import { StubPage } from '../../_components/StubPage'

export default function InsightsMistakesPage(): React.JSX.Element {
  return (
    <StubPage
      title="Insights — Mistakes"
      links={[
        { href: '/insights',     label: 'Insights overview' },
        { href: '/cards',        label: 'Cards' },
        { href: '/review/setup', label: 'Review setup' },
      ]}
    />
  )
}
