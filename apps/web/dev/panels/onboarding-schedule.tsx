'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/onboarding/schedule` lifecycle dev panel.
 */
export const useOnboardingScheduleDevState = createLifecyclePanel({
  id:     'onboarding.schedule',
  title:  'Onboarding · Schedule',
  states: ['submitting', 'error', 'success'],
})
