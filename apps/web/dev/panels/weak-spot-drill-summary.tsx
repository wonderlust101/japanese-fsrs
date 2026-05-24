'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/weak-spots/drill/[sessionId]/summary` drill-summary panel.
 */
export const useWeakSpotDrillSummaryDevState = createLifecyclePanel({
  id:     'weak-spot.drill.summary',
  title:  'Weak-spot drill · Summary',
  states: ['loading', 'error'],
})
