'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/onboarding/interests` lifecycle dev panel.
 */
export const useOnboardingInterestsDevState = createLifecyclePanel({
  id:     'onboarding.interests',
  title:  'Onboarding · Interests',
  states: ['submitting', 'error', 'success'],
})
