import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Leech drill' }

/**
 * Fixed-overlay layout for the entire drill flow (setup → session → summary).
 * Mirrors `review/session/layout.tsx`'s zen pattern: suppresses the app
 * shell so the drill takes the full viewport. Each leaf page is responsible
 * for its own top bar and footer chrome.
 */
export default function LeechDrillLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cool-paper-base overflow-y-auto">
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
