/**
 * Tiny formatting helpers specific to the review staging surface.
 *
 * Kept separate from the dashboard's `dashboard-format.ts` so the staging
 * page can iterate on its own copy and pluralization without leaking
 * staging-specific phrasings into the dashboard.
 */

import { formatExactCount } from '@/app/(app)/dashboard/_components/dashboard-format'

export function pluralizeCards(count: number): string {
  return count === 1 ? 'card' : 'cards'
}

export function pluralizeDecks(count: number): string {
  return count === 1 ? 'deck' : 'decks'
}

export function pluralizeReviews(count: number): string {
  return count === 1 ? 'review' : 'reviews'
}

/**
 * Build the body subhead for the briefing slab. Adapts the phrasing to the
 * shape of today's queue: a calm "begin when ready" register by default, a
 * gentle "start small" register when overdue is heavy, and a welcome-back
 * register when the learner has been paused.
 */
export interface BriefingCopy {
  body:             string
  recommendedStart: number | null
}

export function briefingCopy({
  total,
  newCount,
  reviewCount,
  backlogCount,
  deckCount,
  skippedDays,
}: {
  total:        number
  newCount:     number
  reviewCount:  number
  backlogCount: number
  deckCount:    number
  skippedDays:  number
}): BriefingCopy {
  // Paused / stale (3+ skipped days). Acknowledge the gap honestly, never
  // moralize. The recommendedStart pre-fills the cap control downstream.
  if (skippedDays >= 3 && total > 0) {
    const startGuess = Math.min(total, Math.max(8, Math.round(total * 0.25)))
    return {
      body:             `You skipped ${formatExactCount(skippedDays)} days. Today's stack is ${formatExactCount(total)} ${pluralizeCards(total)}. Start with ${formatExactCount(startGuess)} to ease back in.`,
      recommendedStart: startGuess,
    }
  }

  // Backlog-heavy: overdue >= 20 or backlog dominates the queue. The "start
  // with N today, the rest waits" phrasing follows Tomo's voice from
  // PRODUCT.md ("Tomorrow waits with you").
  if (backlogCount >= 20 || (backlogCount > 0 && backlogCount / Math.max(1, total) >= 0.6)) {
    const startGuess = Math.min(total, Math.max(12, Math.round(total * 0.4)))
    return {
      body:             `${formatExactCount(backlogCount)} overdue from earlier practice. Start with ${formatExactCount(startGuess)} today, the rest waits.`,
      recommendedStart: startGuess,
    }
  }

  // Default register. Read the deck count and the new-vs-review mix into a
  // single short subhead. Joy is structural, not motivational — no "let's
  // do this", no exclamation marks.
  if (total === 0) {
    return {
      body:             'The desk is clear. Cards return when they are close to fading.',
      recommendedStart: null,
    }
  }

  const decksLine = deckCount > 0
    ? `${formatExactCount(deckCount)} ${pluralizeDecks(deckCount)} in today's stack.`
    : "Today's queue is mixed across your shelf."

  if (newCount > 0 && reviewCount > 0) {
    return {
      body:             `${decksLine} ${formatExactCount(reviewCount)} ${pluralizeReviews(reviewCount)} and ${formatExactCount(newCount)} new.`,
      recommendedStart: null,
    }
  }

  if (newCount > 0 && reviewCount === 0) {
    return {
      body:             `${decksLine} All ${formatExactCount(newCount)} are new cards waiting for a first pass.`,
      recommendedStart: null,
    }
  }

  return {
    body:             `${decksLine} Begin when you're ready.`,
    recommendedStart: null,
  }
}

export function briefingKickerKanji(args: {
  isFirstTime: boolean
  isCaughtUp:  boolean
  isPaused:    boolean
  isBacklog:   boolean
}): { kanji: string; label: string } {
  if (args.isFirstTime) return { kanji: '初', label: "FIRST PRACTICE" }
  if (args.isCaughtUp)  return { kanji: '済', label: 'ALL CLEAR' }
  if (args.isPaused)    return { kanji: '戻', label: 'WELCOME BACK' }
  if (args.isBacklog)   return { kanji: '今', label: "TODAY'S PRACTICE" }
  return { kanji: '今', label: "TODAY'S PRACTICE" }
}
