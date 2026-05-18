import type { Metadata } from 'next'

import { WeakSpotsView } from './_components/weak-spots-view'

export const metadata: Metadata = { title: 'Insights · Weak spots' }
export const dynamic = 'force-dynamic'

export default function WeakSpotsPage(): React.JSX.Element {
  return <WeakSpotsView />
}
