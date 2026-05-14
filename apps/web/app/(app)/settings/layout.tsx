import type { Metadata } from 'next'

import { TopBar } from '@/app/(app)/_components/top-bar'

import { SettingsTabBar } from './_components/settings-tab-bar'

export const metadata: Metadata = { title: 'Settings' }

/**
 * Shared chrome for every /settings/* sub-route. Owns the TopBar, the
 * sticky horizontal tab bar that switches between sections, and the
 * centered content column. Each leaf page renders one SectionCard into
 * the outlet.
 *
 * The content column shares its max-width with the tab bar (52rem) so
 * the active tab's underline lines up with the card edges below. The
 * tab bar's soft-hairline border-b still draws across the full viewport
 * for the "tab strip" feel; only the inner row is constrained.
 *
 * Data fetching lives on the leaf pages, not here, so each route only
 * pulls what it actually renders. The auth redirect also lives per-page
 * to keep this layout a pure structural shell.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <TopBar>
        <h1 className="flex-1 font-display text-xl font-medium text-sumi-ink">
          Settings
        </h1>
      </TopBar>

      <SettingsTabBar />

      <main className="mx-auto w-full max-w-[52rem] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {children}
      </main>
    </>
  )
}
