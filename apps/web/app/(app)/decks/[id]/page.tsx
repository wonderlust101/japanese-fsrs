import { redirect }    from 'next/navigation'
import type { Metadata } from 'next'

import { getDeckAction }   from '@/lib/actions/decks.actions'
import { DeckDetailView }  from './_components/deck-detail-view'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const deck   = await getDeckAction(id)
  return { title: deck?.name ?? 'Deck' }
}

export default async function DeckDetailPage({ params }: Props) {
  const { id: deckId } = await params
  const deck           = await getDeckAction(deckId)
  if (deck === null) redirect('/decks')

  return <DeckDetailView deckId={deckId} deckName={deck.name} />
}
