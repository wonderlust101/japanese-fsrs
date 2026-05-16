import type { Metadata } from 'next'

import { MistakesView } from './_components/MistakesView'

export const metadata: Metadata = { title: 'Insights — Mistakes' }

export default function InsightsMistakesPage(): React.JSX.Element {
  return <MistakesView />
}
