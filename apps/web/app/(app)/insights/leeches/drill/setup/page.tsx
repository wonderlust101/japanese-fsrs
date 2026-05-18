import type { Metadata } from 'next'

import { DrillSetupClient } from './_components/drill-setup-client'

export const metadata: Metadata = { title: 'Leech drill setup' }
export const dynamic = 'force-dynamic'

export default function LeechDrillSetupPage(): React.JSX.Element {
  return <DrillSetupClient />
}
