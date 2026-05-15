import type { Metadata } from 'next'

import { getProfileAction } from '@/lib/actions/profile.actions'
import { buildDashboardCalendarContext } from '@/app/(app)/today/_components/today-calendar'

import { TopBar } from '../../_components/top-bar'

import { ReviewStagingClient } from '../_components/review-staging-client'

export const metadata: Metadata = { title: "Reviews — today's stack" }

export default async function ReviewStagingPage(): Promise<React.JSX.Element> {
  const profile = await getProfileAction()
  const calendar = buildDashboardCalendarContext(new Date(), profile?.timezone)

  return (
    <>
      <TopBar desktopHidden />

      <ReviewStagingClient
        initialTodayKey={calendar.todayKey}
        initialTimeZone={calendar.timeZone}
      />
    </>
  )
}
