// Onboarding layout: delegates to OnboardingShell (persistent card-stack chrome)
import type { Metadata } from 'next'
import { OnboardingShell } from './_components/onboarding-shell'

// `title` covers /onboarding (the welcome page is a client component and can't
// export its own metadata). Each onboarding step has its own per-segment
// layout that overrides this title. Whole tree is `noindex` (private flow).
export const metadata: Metadata = {
  title: 'Welcome',
  robots: { index: false, follow: false },
}

/**
 * Onboarding layout. Delegates to OnboardingShell, which owns the persistent
 * card-stack chrome (Logo + step counter + Skip in the header; CardStack with
 * direction-aware transitions in the main).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <OnboardingShell>{children}</OnboardingShell>
}
