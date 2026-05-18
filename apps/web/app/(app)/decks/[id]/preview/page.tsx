import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getDeckAction } from '@/lib/actions/decks.actions'

import { DeckPreviewView } from './_components/deck-preview-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const deck   = await getDeckAction(id)
  return { title: deck === null ? 'Deck preview' : `Preview · ${deck.name}` }
}

export default async function DeckPreviewPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id: deckId } = await params
  const deck           = await getDeckAction(deckId)
  if (deck === null) redirect('/decks')

  return <DeckPreviewView deckId={deckId} deckName={deck.name} />
}
