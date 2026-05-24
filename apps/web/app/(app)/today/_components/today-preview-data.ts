import { addDaysToDateKey } from './today-calendar'
import type { DashboardHeroVariant, DueQueue, HeroDeckPreview } from './today-hero'
import type { HeroDevControls, WeekRhythmPattern } from '@/dev/panels/today'

interface QueueShape {
  total:   number
  newCnt:  number
  backlog: number
}

interface PreviewForecastDay {
  date:         string
  count:        number
  backlogCount: number
  reviewCount:  number
  newCount:     number
}

const PREVIEW_FORECAST_LENGTH = 14

// ── Hero variant preview ─────────────────────────────────────────────────────

export function buildPreviewHeroVariant(controls: HeroDevControls): DashboardHeroVariant {
  switch (controls.variant) {
    case 'due':         return { kind: 'due', queue: buildPreviewQueue(controls) }
    case 'caught-up':   return { kind: 'caught-up' }
    case 'first-time':  return { kind: 'first-time' }
    case 'resume':      return { kind: 'resume', context: { remaining: previewResumeRemaining(controls) } }
  }
}

function previewResumeRemaining(controls: HeroDevControls): number {
  switch (controls.queue) {
    case 'one':           return 1
    case 'no-backlog':    return 8
    case 'typical':       return 12
    case 'backlog-heavy': return 22
    case 'large':         return 38
  }
}

function buildPreviewQueue(controls: HeroDevControls): DueQueue {
  const breakdown = previewQueueBreakdown(controls)
  const total     = breakdown.newCnt + breakdown.review + breakdown.backlog
  const { decks, overflowDecks } = previewDecks(controls.decks, total)

  return {
    total,
    newCnt:     breakdown.newCnt,
    review:     breakdown.review,
    backlog:    breakdown.backlog,
    statusNote: controls.flag === 'stale-data' ? 'Showing the last saved route' : undefined,
    decks,
    overflowDecks,
  }
}

function previewQueueBreakdown(controls: HeroDevControls): { newCnt: number; review: number; backlog: number } {
  const shape   = queuePresetShape(controls.queue)
  const newCnt  = previewNewCount(shape, controls.routeMix)
  const backlog = shape.backlog
  const review  = Math.max(0, shape.total - newCnt - backlog)
  return { newCnt, review, backlog }
}

function queuePresetShape(queue: HeroDevControls['queue']): QueueShape {
  switch (queue) {
    case 'one':           return { total: 1,  newCnt: 0,  backlog: 0  }
    case 'no-backlog':    return { total: 12, newCnt: 3,  backlog: 0  }
    case 'typical':       return { total: 12, newCnt: 3,  backlog: 2  }
    case 'backlog-heavy': return { total: 34, newCnt: 2,  backlog: 19 }
    case 'large':         return { total: 84, newCnt: 18, backlog: 11 }
  }
}

function previewNewCount(shape: QueueShape, routeMix: HeroDevControls['routeMix']): number {
  const todayCapacity = Math.max(0, shape.total - shape.backlog)
  if (todayCapacity <= 0) return 0

  const ratio = routeMix === 'new-heavy'    ? 0.55
              : routeMix === 'review-heavy' ? 0.10
              : null

  if (ratio === null) return Math.min(shape.newCnt, todayCapacity)
  const minNew = todayCapacity === 1 ? 0 : 1
  return Math.min(todayCapacity, Math.max(minNew, Math.round(todayCapacity * ratio)))
}

function previewDecks(
  preset: HeroDevControls['decks'],
  total: number,
): { decks: HeroDeckPreview[]; overflowDecks: number } {
  const samples: [HeroDeckPreview, HeroDeckPreview, HeroDeckPreview] = [
    {
      id:          'preview-n4-verbs',
      title:       'N4 verbs',
      subtitle:    'Conjugation and recall',
      dueCount:    Math.max(1, Math.round(total * 0.45)),
      newCount:    2,
      reviewCount: Math.max(0, Math.round(total * 0.45) - 2),
      tag:         { kind: 'level', level: 'N4' },
    },
    {
      id:          'preview-kanji',
      title:       'Joyo kanji',
      subtitle:    'Recognition practice',
      dueCount:    Math.max(1, Math.round(total * 0.32)),
      newCount:    1,
      reviewCount: Math.max(0, Math.round(total * 0.32) - 1),
      tag:         { kind: 'level', level: 'N3' },
    },
    {
      id:          'preview-grammar',
      title:       'Grammar patterns',
      subtitle:    'Short examples',
      dueCount:    Math.max(1, total - Math.round(total * 0.77)),
      newCount:    0,
      reviewCount: Math.max(1, total - Math.round(total * 0.77)),
      tag:         { kind: 'level', level: 'beyond_jlpt' },
    },
  ]
  const primary         = samples[0]
  const primaryNewCount = primary.newCount ?? 0

  switch (preset) {
    case 'none':
      return { decks: [], overflowDecks: 0 }
    case 'one':
      return {
        decks: [{
          ...primary,
          dueCount:    total,
          reviewCount: Math.max(0, total - primaryNewCount),
        }],
        overflowDecks: 0,
      }
    case 'two':   return { decks: samples.slice(0, 2), overflowDecks: 0 }
    case 'three': return { decks: samples,             overflowDecks: 0 }
    case 'more':  return { decks: samples,             overflowDecks: 4 }
  }
}

// ── Week rhythm preview ──────────────────────────────────────────────────────

export function buildPreviewForecastDays(
  pattern: WeekRhythmPattern,
  todayKey: string,
): PreviewForecastDay[] {
  const out: PreviewForecastDay[] = []
  for (let i = 0; i < PREVIEW_FORECAST_LENGTH; i += 1) {
    const date  = addDaysToDateKey(todayKey, i)
    const shape = previewDayShape(pattern, i)
    out.push({
      date,
      count:        shape.backlog + shape.review + shape.newCnt,
      backlogCount: shape.backlog,
      reviewCount:  shape.review,
      newCount:     shape.newCnt,
    })
  }
  return out
}

function previewDayShape(
  pattern: WeekRhythmPattern,
  i: number,
): { backlog: number; review: number; newCnt: number } {
  switch (pattern) {
    case 'typical':
      return {
        backlog: i === 0 ? 4 : 0,
        review:  [22, 14, 18, 9, 16, 12, 7, 11, 13, 8, 10, 14, 6, 9][i] ?? 8,
        newCnt:  i < 7 ? (i === 0 ? 4 : 2) : 1,
      }
    case 'busy-today':
      return {
        backlog: i === 0 ? 8 : 0,
        review:  i === 0 ? 46 : [4, 6, 3, 5, 4, 2, 3][i] ?? 3,
        newCnt:  i === 0 ? 6 : 1,
      }
    case 'backlog-heavy':
      return {
        backlog: i === 0 ? 28 : i === 1 ? 6 : 0,
        review:  [14, 11, 13, 9, 10, 8, 6, 10, 9, 7, 8, 6, 5, 7][i] ?? 6,
        newCnt:  i === 0 ? 3 : 1,
      }
    case 'new-heavy':
      return {
        backlog: 0,
        review:  [6, 5, 7, 4, 6, 5, 4, 5, 6, 4, 5, 6, 3, 4][i] ?? 4,
        newCnt:  i < 7 ? 10 : 8,
      }
    case 'ramp-up':
      return {
        backlog: i === 0 ? 2 : 0,
        review:  Math.round(4 + i * 4.5),
        newCnt:  i < 7 ? 1 + Math.floor(i / 2) : 2,
      }
    case 'winding-down':
      return {
        backlog: i === 0 ? 6 : 0,
        review:  Math.max(2, Math.round(36 - i * 4)),
        newCnt:  i < 7 ? Math.max(0, 5 - i) : 0,
      }
    case 'caught-up':
      return { backlog: 0, review: 0, newCnt: 0 }
  }
}
