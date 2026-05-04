import { getAuthUser } from '@/lib/supabase/get-auth-user'
import { Sidebar } from './_components/sidebar'
import { MobileBottomBar } from './_components/mobile-bottom-bar'

// The middleware already guarantees an authenticated user reaches this layout.
// We fetch the user here only to pass display data (email) to the Sidebar.
export default async function AppLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const user = await getAuthUser()

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      <Sidebar user={user} />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileBottomBar />
    </div>
  )
}
