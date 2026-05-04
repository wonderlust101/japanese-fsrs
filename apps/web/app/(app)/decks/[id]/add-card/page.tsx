import { redirect } from 'next/navigation'
import { getDeckAction } from '@/lib/actions/decks.actions'
import { AddCardForm } from './_components/add-card-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AddCardPage({ params }: Props): Promise<React.JSX.Element> {
  const { id: deckId } = await params
  const deck = await getDeckAction(deckId)

  if (deck === null) redirect('/decks')

  return <AddCardForm deckId={deckId} deckName={deck.name} />
}
