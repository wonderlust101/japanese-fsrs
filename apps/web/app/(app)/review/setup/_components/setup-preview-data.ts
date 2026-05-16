import type { QueueBreakdown } from '@/lib/review/queue-classify'

import type {
  SetupPreviewState,
  SetupPreviewQueueShape,
} from './setup-dev-toolbar'
import type { DeckRow } from './setup-deck-list'

export interface SetupPreviewSnapshot {
  state:      SetupPreviewState
  breakdown:  QueueBreakdown
  decks:      ReadonlyArray<DeckRow>
  totalDue:   number
  isOnline:   boolean
  isLoading:  boolean
  isError:    boolean
  isFirstTime: boolean
  isCaughtUp: boolean
  isCatchUp:  boolean
}

const QUEUE_SHAPES: Record<SetupPreviewQueueShape, QueueBreakdown> = {
  'small':         { reviewCount: 8,  newCount: 2,  backlogCount: 0  },
  'typical':       { reviewCount: 32, newCount: 12, backlogCount: 3  },
  'review-heavy':  { reviewCount: 60, newCount: 0,  backlogCount: 0  },
  'new-heavy':     { reviewCount: 5,  newCount: 25, backlogCount: 0  },
  'overdue':       { reviewCount: 6,  newCount: 4,  backlogCount: 28 },
}

const DEMO_DECKS: ReadonlyArray<DeckRow> = [
  { id: 'demo-1', name: 'JLPT N4 — Core Vocabulary', level: 'N4', dueCount: 28 },
  { id: 'demo-2', name: 'Joyo Kanji — Grade 4',      level: null, dueCount: 12 },
  { id: 'demo-3', name: 'Grammar — Conditionals',    level: 'N3', dueCount: 5  },
  { id: 'demo-4', name: 'Reading: Yokai Folklore',   level: null, dueCount: 2  },
  { id: 'demo-5', name: 'Beyond JLPT — Literary',    level: 'beyond_jlpt', dueCount: 0 },
]

export function buildPreviewSnapshot(
  state:      SetupPreviewState,
  queueShape: SetupPreviewQueueShape,
): SetupPreviewSnapshot {
  if (state === 'loading') {
    return {
      state,
      breakdown:   { reviewCount: 0, newCount: 0, backlogCount: 0 },
      decks:       [],
      totalDue:    0,
      isOnline:    true,
      isLoading:   true,
      isError:     false,
      isFirstTime: false,
      isCaughtUp:  false,
      isCatchUp:   false,
    }
  }
  if (state === 'error') {
    return {
      state,
      breakdown:   { reviewCount: 0, newCount: 0, backlogCount: 0 },
      decks:       [],
      totalDue:    0,
      isOnline:    true,
      isLoading:   false,
      isError:     true,
      isFirstTime: false,
      isCaughtUp:  false,
      isCatchUp:   false,
    }
  }
  if (state === 'first-time') {
    return {
      state,
      breakdown:   { reviewCount: 0, newCount: 0, backlogCount: 0 },
      decks:       [],
      totalDue:    0,
      isOnline:    true,
      isLoading:   false,
      isError:     false,
      isFirstTime: true,
      isCaughtUp:  false,
      isCatchUp:   false,
    }
  }
  if (state === 'no-reviews') {
    return {
      state,
      breakdown:   { reviewCount: 0, newCount: 0, backlogCount: 0 },
      decks:       DEMO_DECKS,
      totalDue:    0,
      isOnline:    true,
      isLoading:   false,
      isError:     false,
      isFirstTime: false,
      isCaughtUp:  true,
      isCatchUp:   false,
    }
  }

  const breakdown = QUEUE_SHAPES[queueShape]
  const totalDue  = breakdown.reviewCount + breakdown.newCount + breakdown.backlogCount

  // Backlog detection mirrors the staging client's heuristic.
  const isCatchUp = state === 'catch-up' || (
    breakdown.backlogCount >= 20 ||
    (breakdown.backlogCount > 0 && breakdown.backlogCount / Math.max(1, totalDue) >= 0.6)
  )

  return {
    state,
    breakdown,
    decks:       DEMO_DECKS,
    totalDue,
    isOnline:    state !== 'offline',
    isLoading:   false,
    isError:     false,
    isFirstTime: false,
    isCaughtUp:  false,
    isCatchUp,
  }
}
