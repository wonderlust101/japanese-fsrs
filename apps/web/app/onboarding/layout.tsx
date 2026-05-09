// Onboarding layout: delegates to OnboardingShell (persistent card-stack chrome)
import type { Metadata } from 'next'
import { OnboardingShell } from './_components/onboarding-shell'

export const metadata: Metadata = {
  title: 'Get started — Tomo',
}

/**
 * Onboarding layout. Delegates to OnboardingShell, which owns the persistent
 * card-stack chrome (Logo + step counter + Skip in the header; CardStack with
 * direction-aware transitions in the main).
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <OnboardingShell>{children}</OnboardingShell>
}
