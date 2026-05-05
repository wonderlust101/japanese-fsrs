import { redirect }       from 'next/navigation'
import type { Metadata }  from 'next'
import { getDeckAction }  from '@/lib/actions/decks.actions'
import { getCardAction }  from '@/lib/actions/cards.actions'
import { CardDetailView } from './_components/card-detail-view'

interface Props { params: Promise<{ id: string; cardId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: deckId, cardId } = await params
  const card = await getCardAction(deckId, cardId)
  const fd = (card?.fieldsData ?? {}) as Record<string, unknown>
  const word = (fd['word'] ?? fd['front'] ?? 'Card') as string
  return { title: word }
}

export default async function CardDetailPage({ params }: Props): Promise<React.JSX.Element> {
  const { id: deckId, cardId } = await params
  const [deck, card] = await Promise.all([
    getDeckAction(deckId),
    getCardAction(deckId, cardId),
  ])
  if (card === null) redirect(`/decks/${deckId}`)
  return <CardDetailView deckId={deckId} cardId={cardId} deckName={deck?.name ?? 'Deck'} />
}
