import { notFound }    from 'next/navigation'
import type { Metadata } from 'next'

import { getDeckCached }   from '@/lib/data/route-reads'
import { DeckDetailView }  from './_components/deck-detail-view'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const deck   = await getDeckCached(id)
  return { title: deck?.name ?? 'Deck' }
}

export default async function DeckDetailPage({ params }: Props): Promise<React.JSX.Element> {
  const { id: deckId } = await params
  const deck           = await getDeckCached(deckId)
  if (deck === null) notFound()

  return <DeckDetailView deckId={deckId} deckName={deck.name} />
}
