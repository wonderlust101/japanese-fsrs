'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/decks/premade` catalogue lifecycle dev panel.
 */
export const useDecksPremadeDevState = createLifecyclePanel({
  id:     'decks.premade',
  title:  'Decks · Premade',
  states: ['loading', 'error', 'empty'],
})
