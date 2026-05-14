import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getProfileAction }   from '@/lib/actions/profile.actions'
import { getAuthUser }        from '@/lib/supabase/get-auth-user'
import { getUserDisplayName } from '@/lib/supabase/user-metadata'

import { ProfileView } from './_components/profile-view'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const [profile, user] = await Promise.all([
    getProfileAction(),
    getAuthUser(),
  ])

  if (profile === null || user === null) {
    redirect('/login')
  }

  const displayName = getUserDisplayName(user) ?? 'Friend'

  return (
    <ProfileView
      profile={profile}
      email={user.email ?? ''}
      displayName={displayName}
      joinedAt={profile.createdAt}
    />
  )
}
