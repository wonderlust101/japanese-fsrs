export const staleTimes = {
  dueCards:   1000 * 60 * 5,   // 5 min — changes after reviews
  deckList:   1000 * 60 * 10,  // 10 min
  cardDetail: 1000 * 60 * 30,  // 30 min — content rarely changes
  analytics:  1000 * 60 * 60,  // 1 hour
  forecast:   1000 * 60 * 15,  // 15 min
} as const
