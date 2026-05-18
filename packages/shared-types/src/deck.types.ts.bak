export const DeckType = {
  Vocabulary: 'vocabulary',
  Kanji: 'kanji',
  Mixed: 'mixed',
} as const
export type DeckType = typeof DeckType[keyof typeof DeckType]

const DECK_TYPE_VALUES = Object.values(DeckType) as readonly string[]
export const isDeckType = (v: unknown): v is DeckType =>
  typeof v === 'string' && DECK_TYPE_VALUES.includes(v)
