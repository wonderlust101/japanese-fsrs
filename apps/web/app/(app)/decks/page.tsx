import type { Metadata } from 'next'
import { DeckListView } from './_components/deck-list'

export const metadata: Metadata = { title: 'My decks' }

export default function DecksPage(): React.JSX.Element {
  return <DeckListView />
}
