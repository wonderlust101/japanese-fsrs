import type { Metadata } from 'next'

import { PremadeBrowser } from './_components/premade-browser'

export const metadata: Metadata = { title: 'Browse decks' }

export default function PremadeBrowsePage(): React.JSX.Element {
  return <PremadeBrowser />
}
