import type { Metadata } from 'next'

import { getAuthUser } from '@/lib/supabase/get-auth-user'
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
      <Sidebar user={user} />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile chrome: drawer overlay triggered by the hamburger inside TopBar.
          Always rendered; visibility/transform driven by useMobileNavStore. */}
      <MobileDrawer user={user} />
    </div>
  )
}
