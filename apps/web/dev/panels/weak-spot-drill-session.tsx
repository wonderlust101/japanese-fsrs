'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/weak-spots/drill/[sessionId]` drill-session lifecycle panel.
 */
export const useWeakSpotDrillSessionDevState = createLifecyclePanel({
  id:     'weak-spot.drill.session',
  title:  'Weak-spot drill · Session',
  states: ['loading', 'error', 'empty'],
})
