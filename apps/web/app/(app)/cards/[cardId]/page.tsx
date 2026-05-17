import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getCardByIdAction } from '@/lib/actions/cards.actions'
import { getDeckAction } from '@/lib/actions/decks.actions'
import { getWordFields, getSentenceFrontBack } from '@fsrs-japanese/shared-types'

import { CardDetailView } from './_components/card-detail-view'

interface Props { params: Promise<{ cardId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cardId } = await params
  const card = await getCardByIdAction(cardId)
  if (card === null) return { title: 'Card' }
  const wordFields = getWordFields(card)
  if (wordFields !== null) return { title: wordFields.word }
  const sentence = getSentenceFrontBack(card)
  return { title: sentence?.front || 'Card' }
}

export default async function CardDetailPage({ params }: Props): Promise<React.JSX.Element> {
  const { cardId } = await params
  const card = await getCardByIdAction(cardId)
  // `deckId` is nullable on the schema (orphaned card states are permitted by
  // some workflows); a card without a deck has no meaningful detail view here,
  // so route back to the decks list.
  if (card === null || card.deckId === null) redirect('/decks')

  const deck = await getDeckAction(card.deckId)

  return (
    <CardDetailView
      cardId={cardId}
      deckId={card.deckId}
      deckName={deck?.name ?? 'Deck'}
    />
  )
}
