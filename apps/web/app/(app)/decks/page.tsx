import type { Metadata } from 'next'
import { DeckListView } from './_components/deck-list'

export const metadata: Metadata = { title: 'Library' }

export default function DecksPage(): React.JSX.Element {
  return <DeckListView />
}
