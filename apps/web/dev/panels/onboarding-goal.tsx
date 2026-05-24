'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/onboarding/goal` lifecycle dev panel.
 */
export const useOnboardingGoalDevState = createLifecyclePanel({
  id:     'onboarding.goal',
  title:  'Onboarding · Goal',
  states: ['submitting', 'error', 'success'],
})
