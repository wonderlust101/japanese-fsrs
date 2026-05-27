// Onboarding layout: delegates to OnboardingShell (persistent card-stack chrome)
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getProfileAction } from '@/lib/actions/profile.actions'
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
 *
 * Access gate: in development the flow is always reachable, so it can be
 * iterated on regardless of account state. In every other environment a learner
 * who has already been through onboarding — signalled by a target JLPT level on
 * their profile, which the final "Add and begin" step persists — is redirected
 * to /today rather than re-running setup. Fresh accounts (jlptTarget still null,
 * including the skip-without-decks escape path) fall through and onboard
 * normally. If the profile can't be loaded we fail open and allow onboarding.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  if (process.env.NODE_ENV !== 'development') {
    const profile = await getProfileAction()
    if (profile?.jlptTarget != null) redirect('/today')
  }

  return <OnboardingShell>{children}</OnboardingShell>
}
