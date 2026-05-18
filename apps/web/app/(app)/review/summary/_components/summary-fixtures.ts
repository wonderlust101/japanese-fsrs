import type { SessionSummary, SessionWeakSpot } from '@fsrs-japanese/shared-types'

import type { SessionPattern } from '@/lib/review/summary-pattern'

// Synthetic SessionSummary payloads, one per session pattern, used by the dev
// dock to drive every state without needing a backend round-trip. The shape
// satisfies SessionSummarySchema; values are picked to land squarely inside
// each pattern's classifier branch.

const SAMPLE_LEECHES: SessionWeakSpot[] = [
  {
    weakSpotId:      'weakSpot-1',
    cardId:       'card-hiraku',
    deckId:       'deck-jlpt-n4',
    word:         '開く',
    reading:      'ひらく',
    diagnosis:    null,
    prescription: null,
    resolved:     false,
    createdAt:    new Date().toISOString(),
  },
  {
    weakSpotId:      'weakSpot-2',
    cardId:       'card-akeru',
    deckId:       'deck-jlpt-n4',
    word:         '開ける',
    reading:      'あける',
    diagnosis:    null,
    prescription: null,
    resolved:     false,
    createdAt:    new Date().toISOString(),
  },
  {
    weakSpotId:      'weakSpot-3',
    cardId:       'card-shimaru',
    deckId:       'deck-jlpt-n4',
    word:         '閉まる',
    reading:      'しまる',
    diagnosis:    null,
    prescription: null,
    resolved:     false,
    createdAt:    new Date().toISOString(),
  },
  {
    weakSpotId:      'weakSpot-4',
    cardId:       'card-shimeru',
    deckId:       'deck-jlpt-n4',
    word:         '閉める',
    reading:      'しめる',
    diagnosis:    null,
    prescription: null,
    resolved:     false,
    createdAt:    new Date().toISOString(),
  },
]

function base(sessionId: string): Pick<SessionSummary, 'sessionId' | 'nextDueAt'> {
  return {
    sessionId,
    nextDueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  }
}

export const SUMMARY_FIXTURES: Record<SessionPattern, SessionSummary> = {
  strong: {
    ...base('fixture-strong'),
    totalCards:  38,
    totalTimeMs: 9 * 60 * 1000,
    accuracyPct: 95,
    ratingBreakdown: { again: 0, hard: 2, good: 28, easy: 8 },
    weakSpots:     [],
  },
  mixed: {
    ...base('fixture-mixed'),
    totalCards:  42,
    totalTimeMs: 11 * 60 * 1000 + 20 * 1000,
    accuracyPct: 81,
    ratingBreakdown: { again: 4, hard: 5, good: 24, easy: 9 },
    weakSpots:     SAMPLE_LEECHES.slice(0, 2),
  },
  difficult: {
    ...base('fixture-difficult'),
    totalCards:  35,
    totalTimeMs: 14 * 60 * 1000,
    accuracyPct: 58,
    ratingBreakdown: { again: 12, hard: 8, good: 12, easy: 3 },
    weakSpots:     SAMPLE_LEECHES.slice(0, 2),
  },
  weakSpot: {
    ...base('fixture-weakSpot'),
    totalCards:  44,
    totalTimeMs: 13 * 60 * 1000,
    accuracyPct: 72,
    ratingBreakdown: { again: 6, hard: 6, good: 26, easy: 6 },
    weakSpots:     SAMPLE_LEECHES.slice(0, 4),
  },
  'ended-early': {
    ...base('fixture-ended-early'),
    totalCards:  14,
    totalTimeMs: 4 * 60 * 1000,
    accuracyPct: 79,
    ratingBreakdown: { again: 2, hard: 2, good: 8, easy: 2 },
    weakSpots:     SAMPLE_LEECHES.slice(0, 1),
  },
  'no-pattern': {
    ...base('fixture-no-pattern'),
    totalCards:  3,
    totalTimeMs: 90 * 1000,
    accuracyPct: 100,
    ratingBreakdown: { again: 0, hard: 0, good: 2, easy: 1 },
    weakSpots:     [],
  },
}

export const SUMMARY_FIXTURE_KEYS: SessionPattern[] = [
  'strong',
  'mixed',
  'difficult',
  'weakSpot',
  'ended-early',
  'no-pattern',
]

export function summaryFixtureLabel(pattern: SessionPattern): string {
  switch (pattern) {
    case 'strong':      return 'Strong session'
    case 'mixed':       return 'Mixed session'
    case 'difficult':   return 'Difficult session'
    case 'weakSpot':       return 'WeakSpot-like'
    case 'ended-early': return 'Ended early'
    case 'no-pattern':  return 'No pattern'
  }
}

// Mock meanings keyed by cardId, used by WeakSpotRow when the fixture
// renders. Production rows source meaning from card detail, not from the
// summary payload — but the fixtures should look fleshed out.
export const FIXTURE_MEANINGS: Record<string, string> = {
  'card-hiraku':  'to open (intransitive)',
  'card-akeru':   'to open (transitive)',
  'card-shimaru': 'to close (intransitive)',
  'card-shimeru': 'to close (transitive)',
}
