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
    // Cross-deck browser. The filter object is part of the key so each
    // (deck, status, jlpt, search, missingField, sort) combination caches
    // independently — matches the weak-spots list pattern.
    crossDeck:     (filters: object) => [...queryKeys.cards.all(), 'crossDeck', filters] as const,
    qualityIssues: ()                => [...queryKeys.cards.all(), 'qualityIssues']      as const,
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
  insights: {
    // The Stage 9 maturity-history endpoint accepts `days` ∈ {90, 180, 365};
    // the window is part of the cache key so each window caches independently
    // (a learner who toggles between 90/365 day views doesn't refetch the
    // same row twice for the same window).
    maturityHistory: (days: '90' | '180' | '365') =>
      ['insights', 'maturity-history', days] as const,
    // Bundled rating/interval/stability/difficulty distributions for
    // the Statistics page. One round-trip, one cache entry.
    distributions: () => ['insights', 'distributions'] as const,
  },
  weakSpots: {
    all:    ()                       => ['weakSpots']                              as const,
    // The filter object is included in the cache key so each (status, deck,
    // jlpt, diagnosis, sort) combination is fetched and cached
    // independently. Matches the doc's "query keys must include every filter
    // dimension" requirement.
    list:   (filters: object)        => [...queryKeys.weakSpots.all(), 'list', filters]      as const,
    detail: (id: string)             => [...queryKeys.weakSpots.all(), 'detail', id]         as const,
    // Drill session cache key family — scoped under weakSpots.all() so the
    // existing namespace-wide invalidation in resolve/reopen/diagnose
    // sweeps drill caches too. A drill session that targets a weakSpot that
    // has just been resolved should refetch on next mount, not serve a
    // stale snapshot.
    drillSession: (id: string)       => [...queryKeys.weakSpots.all(), 'drillSession', id]   as const,
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
