import type { PinnedDeck, TomoNote } from './staging-pinned-deck'
import type { YesterdayStat } from './staging-metadata-row'
import type {
  StagingDevControls,
  StagingPreviewQueueShape,
  StagingPreviewVariant,
} from './staging-dev-toolbar'

export interface PreviewQueueBreakdown {
  newCount:     number
  reviewCount:  number
  backlogCount: number
}

/**
 * Synthesized snapshot of every derived value the v2 staging surface
 * consumes. Mirrors the live state machine exactly so the dev toolbar
 * swaps in preview values without each component knowing it's in preview.
 */
export interface StagingPreviewState {
  isLoading:    boolean
  isError:      boolean
  hasDecks:     boolean
  totalDue:     number
  breakdown:    PreviewQueueBreakdown | null
  pinnedDeck:   PinnedDeck | null
  tomoNote:     TomoNote | null
  yesterday:    YesterdayStat | null
  leechCount:   number | null
  isFirstTime:  boolean
  isCaughtUp:   boolean
  isBacklog:    boolean
  isPaused:     boolean
  skippedDays:  number
}

const SAMPLE_DECK: PinnedDeck = {
  id:             'preview-n3-verbs',
  title:          'N3 verbs',
  level:          'N3',
  dueCount:       0,
  newCount:       0,
  reviewCount:    0,
  backlogCount:   0,
  totalCards:     320,
  masteryPercent: 42,
}

const SAMPLE_TOMO_NOTE: TomoNote = {
  body: "You're steady on N3 verbs. Give a little extra care to 払う today; it has been slipping in sentence contexts.",
}

const SAMPLE_YESTERDAY: YesterdayStat = { reviewed: 24, retention: 87 }
const SAMPLE_LEECH_COUNT: number = 3

export function buildPreviewState(controls: StagingDevControls): StagingPreviewState {
  switch (controls.variant) {
    case 'loading':
      return baseEmpty({ isLoading: true })

    case 'error':
      return baseEmpty({ isError: true, hasDecks: true })

    case 'first-time':
      return {
        ...baseEmpty({ hasDecks: false }),
        isFirstTime: true,
        breakdown:   { newCount: 0, reviewCount: 0, backlogCount: 0 },
        yesterday:   null,
        leechCount:  null,
      }

    case 'all-clear':
      return {
        ...baseEmpty({ hasDecks: true }),
        isCaughtUp:  true,
        breakdown:   { newCount: 0, reviewCount: 0, backlogCount: 0 },
        pinnedDeck:  applyDeckBreakdown(SAMPLE_DECK, { newCount: 0, reviewCount: 0, backlogCount: 0 }),
        tomoNote:    null,
        yesterday:   SAMPLE_YESTERDAY,
        leechCount:  null,
      }

    case 'paused': {
      const breakdown: PreviewQueueBreakdown = { newCount: 1, reviewCount: 13, backlogCount: 0 }
      const totalDue = breakdown.newCount + breakdown.reviewCount + breakdown.backlogCount
      return {
        ...baseEmpty({ hasDecks: true }),
        isPaused:    true,
        skippedDays: 4,
        totalDue,
        breakdown,
        pinnedDeck:  applyDeckBreakdown(SAMPLE_DECK, breakdown),
        tomoNote:    null,
        yesterday:   { reviewed: 0, retention: null },
        leechCount:  SAMPLE_LEECH_COUNT,
      }
    }

    case 'backlog': {
      const breakdown = breakdownForQueueShape(controls.queueShape, true)
      const totalDue = breakdown.newCount + breakdown.reviewCount + breakdown.backlogCount
      return {
        ...baseEmpty({ hasDecks: true }),
        isBacklog:   true,
        totalDue,
        breakdown,
        pinnedDeck:  applyDeckBreakdown(SAMPLE_DECK, breakdown),
        tomoNote:    SAMPLE_TOMO_NOTE,
        yesterday:   { reviewed: 12, retention: 79 },
        leechCount:  SAMPLE_LEECH_COUNT,
      }
    }

    case 'default':
    default: {
      const breakdown = breakdownForQueueShape(controls.queueShape, false)
      const totalDue = breakdown.newCount + breakdown.reviewCount + breakdown.backlogCount
      const willBeBacklog = breakdown.backlogCount >= 20
        || (breakdown.backlogCount > 0 && breakdown.backlogCount / Math.max(1, totalDue) >= 0.6)
      return {
        ...baseEmpty({ hasDecks: true }),
        isBacklog:   willBeBacklog,
        totalDue,
        breakdown,
        pinnedDeck:  applyDeckBreakdown(SAMPLE_DECK, breakdown),
        tomoNote:    SAMPLE_TOMO_NOTE,
        yesterday:   SAMPLE_YESTERDAY,
        leechCount:  SAMPLE_LEECH_COUNT,
      }
    }
  }
}

function baseEmpty(overrides: Partial<StagingPreviewState> = {}): StagingPreviewState {
  return {
    isLoading:    false,
    isError:      false,
    hasDecks:     true,
    totalDue:     0,
    breakdown:    null,
    pinnedDeck:   null,
    tomoNote:     null,
    yesterday:    null,
    leechCount:   null,
    isFirstTime:  false,
    isCaughtUp:   false,
    isBacklog:    false,
    isPaused:     false,
    skippedDays:  0,
    ...overrides,
  }
}

function breakdownForQueueShape(
  shape:     StagingPreviewQueueShape,
  asBacklog: boolean,
): PreviewQueueBreakdown {
  if (asBacklog) {
    if (shape === 'heavy-backlog') return { newCount: 5, reviewCount: 8, backlogCount: 67 }
    if (shape === 'one')           return { newCount: 0, reviewCount: 0, backlogCount: 1 }
    return { newCount: 3, reviewCount: 7, backlogCount: 32 }
  }

  switch (shape) {
    case 'one':           return { newCount: 0, reviewCount: 1, backlogCount: 0 }
    case 'typical':       return { newCount: 2, reviewCount: 10, backlogCount: 0 }
    case 'heavy-backlog': return { newCount: 2, reviewCount: 8, backlogCount: 32 }
    case 'review-heavy':  return { newCount: 2, reviewCount: 22, backlogCount: 0 }
    case 'new-heavy':     return { newCount: 18, reviewCount: 6, backlogCount: 0 }
  }
}

function applyDeckBreakdown(deck: PinnedDeck, breakdown: PreviewQueueBreakdown): PinnedDeck {
  return {
    ...deck,
    dueCount:     breakdown.newCount + breakdown.reviewCount + breakdown.backlogCount,
    newCount:     breakdown.newCount,
    reviewCount:  breakdown.reviewCount,
    backlogCount: breakdown.backlogCount,
  }
}

export function previewVariantBlocksBegin(variant: StagingPreviewVariant): boolean {
  return variant === 'loading' || variant === 'error'
}
