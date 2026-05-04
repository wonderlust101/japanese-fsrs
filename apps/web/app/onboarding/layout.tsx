import type { Metadata } from 'next'
import { OnboardingHeader } from './_components/onboarding-header'
import { PageTransition } from './_components/page-transition'

export const metadata: Metadata = {
  title: 'Get started — FSRS Japanese',
}

/**
 * Onboarding layout — no sidebar, no global nav.
 *
 * Provides:
 *  - A persistent header with the step-dot indicator and per-step Skip button.
 *  - A `<PageTransition>` wrapper that keys off the current pathname so each
 *    step page receives a CSS enter animation without needing framer-motion.
 *
 * State is managed by `useOnboardingStore` (Zustand + sessionStorage) so that
 * selections survive page refreshes and are accessible across all five pages
 * without prop drilling or a React context wrapper here.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <OnboardingHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <PageTransition>
          <div className="w-full max-w-2xl mx-auto">
            {children}
          </div>
        </PageTransition>
      </main>
    </div>
  )
}
