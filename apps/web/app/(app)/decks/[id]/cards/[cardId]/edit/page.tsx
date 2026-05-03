import { redirect }      from 'next/navigation'
import type { Metadata } from 'next'
import { getDeckAction } from '@/lib/actions/decks.actions'
import { getCardAction } from '@/lib/actions/cards.actions'
import { EditCardForm }  from './_components/edit-card-form'

interface Props { params: Promise<{ id: string; cardId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: deckId, cardId } = await params
  const card = await getCardAction(deckId, cardId)
  const word = (card?.fieldsData['word'] ?? 'Card') as string
  return { title: `Edit ${word}` }
}

export default async function EditCardPage({ params }: Props) {
  const { id: deckId, cardId } = await params
  const [deck, card] = await Promise.all([
    getDeckAction(deckId),
    getCardAction(deckId, cardId),
  ])
  if (card === null) redirect(`/decks/${deckId}`)
  return <EditCardForm card={card} deckId={deckId} deckName={deck?.name ?? 'Deck'} />
}
