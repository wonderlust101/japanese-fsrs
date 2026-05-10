import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getProfileAction } from '@/lib/actions/profile.actions'
import { getAuthUser } from '@/lib/supabase/get-auth-user'
import { getUserDisplayName } from '@/lib/supabase/user-metadata'
import { SettingsView } from './_components/settings-view'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const [profile, user] = await Promise.all([
    getProfileAction(),
    getAuthUser(),
  ])

  if (profile === null || user === null) {
    redirect('/login')
  }

  const displayName = getUserDisplayName(user) ?? ''

  return (
    <SettingsView
      initialProfile={profile}
      email={user.email ?? ''}
      displayName={displayName}
    />
  )
}
