import type { ApiDueCard } from '@fsrs-japanese/shared-types'

import {
  calendarDateKeyFromApiDate,
  isDashboardDateKey,
} from '@/app/(app)/today/_components/today-calendar'

const FSRS_NEW = 0

export type QueueKind = 'new' | 'review' | 'backlog'

export interface QueueBreakdown {
  newCount:     number
  reviewCount:  number
  backlogCount: number
}

export const EMPTY_BREAKDOWN: QueueBreakdown = {
  newCount:     0,
  reviewCount:  0,
  backlogCount: 0,
}

export function classifyCard(
  card:     ApiDueCard,
  todayKey: string,
  timeZone: string,
): QueueKind {
  if (card.state === FSRS_NEW) return 'new'
  const dueKey = calendarDateKeyFromApiDate(card.due, timeZone)
  if (isDashboardDateKey(dueKey) && isDashboardDateKey(todayKey) && dueKey < todayKey) return 'backlog'
  return 'review'
}

export function countQueueBreakdown(
  items:    ReadonlyArray<ApiDueCard>,
  todayKey: string,
  timeZone: string,
): QueueBreakdown {
  let n = 0, r = 0, b = 0
  for (const card of items) {
    const k = classifyCard(card, todayKey, timeZone)
    if      (k === 'new')     n++
    else if (k === 'review')  r++
    else                       b++
  }
  return { newCount: n, reviewCount: r, backlogCount: b }
}

export function totalFromBreakdown(b: QueueBreakdown): number {
  return b.newCount + b.reviewCount + b.backlogCount
}

// Backlog first → review → new. Mirrors the in-session urgency model.
export function priorityForKind(kind: QueueKind): number {
  if (kind === 'backlog') return 0
  if (kind === 'review')  return 1
  return 2
}
