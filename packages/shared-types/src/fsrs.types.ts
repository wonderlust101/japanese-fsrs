export { State } from 'ts-fsrs'

export const CardType = {
  Comprehension: 'comprehension',
  Production:    'production',
  Listening:     'listening',
} as const
export type CardType = typeof CardType[keyof typeof CardType]

const CARD_TYPE_VALUES = Object.values(CardType) as readonly string[]
export const isCardType = (v: unknown): v is CardType =>
  typeof v === 'string' && CARD_TYPE_VALUES.includes(v)
