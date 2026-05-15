import { StubPage } from '../../../_components/StubPage'

interface PageProps {
  params: Promise<{ cardId: string }>
}

export default async function ProblemCardRepairPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { cardId } = await params
  return (
    <StubPage
      title="Problem Card Repair"
      links={[
        { href: `/cards/${cardId}`, label: 'Back to card' },
        { href: '/review/setup',    label: 'Review setup' },
      ]}
    />
  )
}
