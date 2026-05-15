import type { ApiDeck, ApiDueCard } from '@fsrs-japanese/shared-types'

import { inferDeckLevel } from '@/lib/deck-level'

import { calendarDateKeyFromApiDate, isDashboardDateKey } from './today-calendar'
import type { DueQueue, HeroDeckPreview, HeroDeckTag } from './today-hero'

const FSRS_NEW = 0
const MAX_HERO_DECKS = 3

export interface QueueBreakdown {
  newCnt:  number
  review:  number
  backlog: number
}

export function buildHeroQueueFromDueCards(
  items: ApiDueCard[],
  todayKey: string,
  timeZone: string,
  deckById: ReadonlyMap<string, ApiDeck>,
): DueQueue {
  const breakdown   = countQueueBreakdown(items, todayKey, timeZone)
  const grouped     = groupDueCards(items)
  const deckEntries = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)
  const decks       = deckEntries
    .slice(0, MAX_HERO_DECKS)
    .map(([, cards], index) => toHeroDeck(cards, index, deckById))

  return {
    total:         breakdown.newCnt + breakdown.review + breakdown.backlog,
    newCnt:        breakdown.newCnt,
    review:        breakdown.review,
    backlog:       breakdown.backlog,
    decks,
    overflowDecks: Math.max(0, deckEntries.length - decks.length),
  }
}

export function countQueueBreakdown(
  items: ApiDueCard[],
  todayKey: string,
  timeZone: string,
): QueueBreakdown {
  let backlog = 0
  let newCnt  = 0
  let review  = 0

  for (const card of items) {
    if (card.state === FSRS_NEW) newCnt += 1
    else if (isOverdue(card, todayKey, timeZone)) backlog += 1
    else review += 1
  }

  return { newCnt, review, backlog }
}

export function groupDueCards(items: ApiDueCard[]): Map<string, ApiDueCard[]> {
  const out = new Map<string, ApiDueCard[]>()
  for (const card of items) {
    const key    = card.deckId ?? `${card.jlptLevel ?? 'mixed'}-${card.layoutType}`
    const bucket = out.get(key)
    if (bucket === undefined) out.set(key, [card])
    else bucket.push(card)
  }
  return out
}

function toHeroDeck(
  cards: ApiDueCard[],
  index: number,
  deckById: ReadonlyMap<string, ApiDeck>,
): HeroDeckPreview {
  const layout     = dominant(cards.map((c) => c.layoutType))
  const newCount   = cards.filter((c) => c.state === FSRS_NEW).length
  const deckId     = cards[0]?.deckId
  const sourceDeck = deckId != null ? deckById.get(deckId) : undefined

  const title = sourceDeck?.name
    ?? (deckId != null ? 'Active deck' : `${formatLayoutType(layout)} queue`)

  const cardLevels = cards
    .map((c) => c.jlptLevel)
    .filter((l): l is NonNullable<ApiDueCard['jlptLevel']> => l !== null)
  const level = dominant(cardLevels)
    ?? (sourceDeck !== undefined ? inferDeckLevel(sourceDeck) : null)

  const tag: HeroDeckTag = level !== null
    ? { kind: 'level', level }
    : { kind: 'none' }

  const subtitle = sourceDeck !== undefined
    ? 'Active deck queue'
    : (deckId != null ? 'Deck metadata unavailable' : 'Mixed queue')

  return {
    id:          deckId ?? `queue-${index}`,
    title,
    subtitle,
    dueCount:    cards.length,
    newCount,
    reviewCount: cards.length - newCount,
    tag,
  }
}

function isOverdue(card: ApiDueCard, todayKey: string, timeZone: string): boolean {
  const dueKey = calendarDateKeyFromApiDate(card.due, timeZone)
  return isDashboardDateKey(dueKey) && isDashboardDateKey(todayKey) && dueKey < todayKey
}

export function dominant<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function formatLayoutType(layout: ApiDueCard['layoutType'] | null): string {
  switch (layout) {
    case 'grammar':    return 'Grammar'
    case 'sentence':   return 'Sentence'
    case 'vocabulary': return 'Vocabulary'
    default:           return 'Mixed'
  }
}
