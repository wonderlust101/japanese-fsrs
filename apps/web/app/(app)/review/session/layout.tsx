import { SessionHeader }   from './_components/session-header'
import { SessionProgress } from './_components/session-progress'

export default function ReviewSessionLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-warm-paper-base">
      <SessionHeader />
      <SessionProgress />

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
