import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getDeckCached } from '@/lib/data/route-reads'

import { DeckPreviewView } from './_components/deck-preview-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const deck   = await getDeckCached(id)
  return { title: deck === null ? 'Deck preview' : `Preview · ${deck.name}` }
}

export default async function DeckPreviewPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id: deckId } = await params
  const deck           = await getDeckCached(deckId)
  if (deck === null) redirect('/decks')

  return <DeckPreviewView deckId={deckId} deckName={deck.name} />
}
