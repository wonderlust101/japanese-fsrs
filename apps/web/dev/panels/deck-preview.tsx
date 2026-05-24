'use client'

import { createLifecyclePanel } from './_factory'

/**
 * `/decks/[id]/preview` premade-deck preview lifecycle dev panel.
 */
export const useDeckPreviewDevState = createLifecyclePanel({
  id:     'deck.preview',
  title:  'Deck · Preview',
  states: ['loading', 'error'],
})
