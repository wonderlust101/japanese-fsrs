import type { Metadata } from 'next'

import { DrillSessionClient } from './_components/drill-session-client'

export const metadata: Metadata = { title: 'Leech drill' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default async function LeechDrillSessionPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { sessionId } = await params
  return <DrillSessionClient sessionId={sessionId} />
}
