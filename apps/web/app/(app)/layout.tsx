import type { Metadata } from 'next'

import { HelpDialog } from '@/components/help/HelpDialog'
import { getAuthUser } from '@/lib/supabase/get-auth-user'
import { GlobalHelpKeybind } from './_components/global-help-keybind'
import { RouteFocusManager } from './_components/route-focus-manager'
import { Sidebar } from './_components/sidebar'
import { MobileDrawer } from './_components/mobile-drawer'

// Authenticated app surface — search engines should never index any of these
// routes. Per-page titles set in each page.tsx flow through the root template.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// The middleware already guarantees an authenticated user reaches this layout.
// We fetch the user here only to pass display data (email) to the chrome.
export default async function AppLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const user = await getAuthUser()

  return (
    <div className="flex h-screen bg-cool-paper-base overflow-hidden">
      {/* Skip link: first focusable element so keyboard users can bypass the
          sidebar nav. Visually hidden until focused; --z-toast keeps it above
          all chrome when it appears. Targets the <main> below. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[var(--z-toast)] focus-visible:rounded-xs focus-visible:border focus-visible:border-soft-hairline focus-visible:bg-warm-paper-raised focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-sumi-ink focus-visible:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink"
      >
        Skip to main content
      </a>
      <Sidebar user={user} />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main id="main-content" tabIndex={-1} className="flex flex-col flex-1 overflow-y-auto outline-none">
          {children}
        </main>
      </div>

      {/* Mobile chrome: drawer overlay triggered by the hamburger inside TopBar.
          Always rendered; visibility/transform driven by useMobileNavStore. */}
      <MobileDrawer user={user} />

      {/* Global help: dialog + ? keybind, mounted once for every (app) route.
          Opened from the sidebar/drawer HelpRow or the ? shortcut. */}
      <HelpDialog />
      <GlobalHelpKeybind />
      <RouteFocusManager />
    </div>
  )
}
