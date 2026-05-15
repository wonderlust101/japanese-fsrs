import { StubPage } from '../../../_components/StubPage'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DeckPreviewPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params
  return (
    <StubPage
      title="Deck Preview"
      links={[
        { href: `/decks/${id}`, label: 'Open deck' },
        { href: '/decks',       label: 'All decks' },
      ]}
    />
  )
}
