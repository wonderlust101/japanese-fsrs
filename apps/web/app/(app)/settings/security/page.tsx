import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getAuthUser } from '@/lib/supabase/get-auth-user'

import { SecuritySection } from '../_components/security-section'

export const metadata: Metadata = { title: 'Settings · Security' }
export const dynamic = 'force-dynamic'

export default async function SettingsSecurityPage(): Promise<React.JSX.Element> {
  const user = await getAuthUser()
  if (user === null) redirect('/login')

  return <SecuritySection />
}
