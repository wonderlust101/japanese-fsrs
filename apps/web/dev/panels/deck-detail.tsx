'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/decks/[id]` deck-detail lifecycle dev panel.
 */
export const useDeckDetailDevState = createLifecyclePanel({
  id:     'deck.detail',
  title:  'Deck · Detail',
  states: ['loading', 'error', 'empty'],
})
