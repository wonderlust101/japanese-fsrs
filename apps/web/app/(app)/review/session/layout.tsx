import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Review session' }

// Fixed-overlay zen layout. The session page mounts a fixed top bar
// (SessionTopBar) and a fixed bottom rating bar; the centered SectionCard
// sits between them. The layout itself only suppresses the app sidebar and
// hands a vertically centering flex container to the page.

export default function ReviewSessionLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cool-paper-base overflow-y-auto">
      {/* The page is free to mount its own fixed top bar; the main area
          reserves vertical space so the card centers between the bar above
          and the bar below. Padding-top accounts for the fixed top bar
          (~56px). The bottom space is reserved by the page wrapper's pb. */}
      <main className="flex-1 flex flex-col items-stretch justify-center pt-14 md:pt-14">
        {children}
      </main>
    </div>
  )
}
