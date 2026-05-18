import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getCardByIdAction } from '@/lib/actions/cards.actions'
import { getDeckAction } from '@/lib/actions/decks.actions'
import { getWordFields, getSentenceFrontBack } from '@fsrs-japanese/shared-types'

import { RepairView } from './_components/repair-view'

interface PageProps { params: Promise<{ cardId: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cardId } = await params
  const card = await getCardByIdAction(cardId)
  if (card === null) return { title: 'Repair card' }
  const wordFields = getWordFields(card)
  if (wordFields !== null) return { title: `Repair · ${wordFields.word}` }
  const sentence = getSentenceFrontBack(card)
  return { title: `Repair · ${sentence?.front || 'card'}` }
}

export default async function CardRepairPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { cardId } = await params
  const card = await getCardByIdAction(cardId)
  if (card === null || card.deckId === null) redirect('/decks')

  const deck = await getDeckAction(card.deckId)
  return (
    <RepairView
      cardId={cardId}
      deckId={card.deckId}
      deckName={deck?.name ?? 'Deck'}
    />
  )
}
