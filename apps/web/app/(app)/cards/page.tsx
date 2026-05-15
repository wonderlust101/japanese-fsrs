import { StubPage } from '../_components/StubPage'

export default function CardsBrowserPage(): React.JSX.Element {
  return (
    <StubPage
      title="Cards"
      links={[
        { href: '/decks', label: 'Decks' },
        { href: '/today', label: 'Today' },
      ]}
    />
  )
}
