import type { Metadata } from 'next'

import { LeechesView } from './_components/leeches-view'

export const metadata: Metadata = { title: 'Insights · Weak spots' }
export const dynamic = 'force-dynamic'

export default function LeechesPage(): React.JSX.Element {
  return <LeechesView />
}
