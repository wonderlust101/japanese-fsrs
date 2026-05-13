import type { Metadata } from 'next'

import { getProfileAction } from '@/lib/actions/profile.actions'
import { getAuthUser } from '@/lib/supabase/get-auth-user'
import { getUserDisplayName } from '@/lib/supabase/user-metadata'

import { TopBar } from '../_components/top-bar'

import { buildDashboardCalendarContext } from './_components/dashboard-calendar'
import { DashboardClient } from './_components/dashboard-client'

export const metadata: Metadata = { title: 'Dashboard' }

function firstName(displayName: string | undefined): string | null {
  const trimmed = displayName?.trim()
  if (trimmed == null || trimmed.length === 0) return null
  return trimmed.split(/\s+/)[0] ?? null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const today = new Date()
  const [user, profile] = await Promise.all([
    getAuthUser(),
    getProfileAction(),
  ])
  const calendar = buildDashboardCalendarContext(today, profile?.timezone)
  const greetingName = firstName(getUserDisplayName(user))

  return (
    <>
      <TopBar desktopHidden />

      <div className="pb-24 lg:pb-32">
        <DashboardClient
          dateLabel={calendar.dateLabel}
          dateTime={calendar.dateTime}
          greetingName={greetingName}
          greetingPrefix={calendar.greetingPrefix}
          timeZone={calendar.timeZone}
        />
      </div>
    </>
  )
}
