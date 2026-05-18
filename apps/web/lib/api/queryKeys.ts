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
    dashboard:  () => ['analytics', 'dashboard']  as const,
    heatmap:    () => ['analytics', 'heatmap']    as const,
    accuracy:   () => ['analytics', 'accuracy']   as const,
    jlptGap:    () => ['analytics', 'jlpt-gap']   as const,
    milestones: () => ['analytics', 'milestones'] as const,
  },
  leeches: {
    all:    ()                       => ['leeches']                              as const,
    // The filter object is included in the cache key so each (status, deck,
    // jlpt, diagnosis, sort) combination is fetched and cached
    // independently. Matches the doc's "query keys must include every filter
    // dimension" requirement.
    list:   (filters: object)        => [...queryKeys.leeches.all(), 'list', filters]      as const,
    detail: (id: string)             => [...queryKeys.leeches.all(), 'detail', id]         as const,
    // Drill session cache key family — scoped under leeches.all() so the
    // existing namespace-wide invalidation in resolve/reopen/diagnose
    // sweeps drill caches too. A drill session that targets a leech that
    // has just been resolved should refetch on next mount, not serve a
    // stale snapshot.
    drillSession: (id: string)       => [...queryKeys.leeches.all(), 'drillSession', id]   as const,
  },
  premadeDecks: {
    all:    ()           => ['premade-decks']                              as const,
    list:   ()           => [...queryKeys.premadeDecks.all(), 'list']      as const,
    detail: (id: string) => [...queryKeys.premadeDecks.all(), 'detail', id] as const,
    // `subscriptions` key removed in Backend Completion Plan Stage 4 (copy
    // model) — the subscription concept no longer exists. "Decks I started
    // from a premade" is now a client-side filter on `queryKeys.decks.list()`
    // by `sourcePremadeId IS NOT NULL`.
  },
  profile: {
    me: () => ['profile', 'me'] as const,
  },
  tomo: {
    // Backend Completion Plan Stage 6 — one note per learner per calendar
    // day. The key is intentionally undated; the server's cache (keyed by
    // learner-local dateKey) handles the day boundary, and the TanStack
    // staleTime keeps multiple component subscriptions cheap.
    note: () => ['tomo', 'note'] as const,
  },
} as const
