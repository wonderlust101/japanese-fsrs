import { redirect } from 'next/navigation'

import { getProfileAction } from '@/lib/actions/profile.actions'
import { getAuthUser } from '@/lib/supabase/get-auth-user'
import { SettingsView } from './_components/settings-view'

export const dynamic = 'force-dynamic'

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const [profile, user] = await Promise.all([
    getProfileAction(),
    getAuthUser(),
  ])

  if (profile === null || user === null) {
    redirect('/login')
  }

  const displayName = (user.user_metadata?.['display_name'] as string | undefined)
    ?? (user.user_metadata?.['full_name'] as string | undefined)
    ?? ''

  return (
    <SettingsView
      initialProfile={profile}
      email={user.email ?? ''}
      displayName={displayName}
    />
  )
}
