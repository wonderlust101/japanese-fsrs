export const staleTimes = {
  dueCards:   1000 * 60 * 5,   // 5 min — changes after reviews
  deckList:   1000 * 60 * 10,  // 10 min
  cardDetail: 1000 * 60 * 30,  // 30 min — content rarely changes
  analytics:  1000 * 60 * 60,  // 1 hour
  forecast:   1000 * 60 * 15,  // 15 min
  // Tomo note is server-cached for the full learner-local day; the client
  // staleTime just keeps multiple component mounts from refetching during
  // a single browsing session. 1 hour is enough — the next /review visit
  // tomorrow will refetch naturally.
  tomoNote:   1000 * 60 * 60,  // 1 hour
  // Cards browser list. Short — the user is actively filtering, and any
  // mutation (delete, suspend, move) invalidates via queryKeys.cards.all().
  cardsList:  1000 * 60 * 2,   // 2 min
} as const
