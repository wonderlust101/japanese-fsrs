export const queryKeys = {
  decks: {
    all:    ()           => ['decks']                                 as const,
    list:   ()           => [...queryKeys.decks.all(), 'list']        as const,
    detail: (id: string) => [...queryKeys.decks.all(), 'detail', id] as const,
  },
  cards: {
    all:     ()               => ['cards']                                        as const,
    byDeck:  (deckId: string) => [...queryKeys.cards.all(), 'deck', deckId]       as const,
    detail:  (id: string)     => [...queryKeys.cards.all(), 'detail', id]         as const,
    similar: (id: string)     => [...queryKeys.cards.all(), 'similar', id]        as const,
  },
  reviews: {
    due:      ()           => ['reviews', 'due']            as const,
    forecast: ()           => ['reviews', 'forecast']       as const,
    summary:  (id: string) => ['reviews', 'summary', id]   as const,
  },
  analytics: {
    heatmap:  () => ['analytics', 'heatmap']  as const,
    accuracy: () => ['analytics', 'accuracy'] as const,
    jlptGap:  () => ['analytics', 'jlpt-gap'] as const,
  },
} as const
