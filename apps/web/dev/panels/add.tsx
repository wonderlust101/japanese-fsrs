'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/add` lifecycle dev panel. Used by the capture entry point to force its
 * loading and error branches without manipulating the profile fetch or the
 * downstream AI generation network calls.
 */
export const useAddDevState = createLifecyclePanel({
  id:     'add.capture',
  title:  'Add · Capture',
  states: ['loading', 'error'],
})
