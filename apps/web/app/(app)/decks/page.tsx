import type { Metadata } from 'next'
import { DeckListView } from './_components/deck-list'

export const metadata: Metadata = { title: 'My Decks' }

export default function DecksPage() {
  return <DeckListView />
}
