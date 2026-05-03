import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

import type { ReviewRating } from '@fsrs-japanese/shared-types'
import type { DueCard } from '@/lib/actions/reviews.actions'

// ── State (data only) ─────────────────────────────────────────────────────────

interface SessionHistoryEntry {
  card:   DueCard
  rating: ReviewRating
}

interface ReviewSessionState {
  queue:          DueCard[]
  currentIndex:   number
  showAnswer:     boolean
  sessionHistory: SessionHistoryEntry[]
  /** True while a session is active; false after endSession() or before startSession(). */
  sessionStarted: boolean
  /** UUID generated at session start; kept after endSession() so the summary page can fetch. Cleared by reset(). */
  sessionId:      string | null
}

// ── Actions (functions only) ──────────────────────────────────────────────────

interface ReviewSessionActions {
  startSession: (cards: DueCard[]) => void
  flipCard:     () => void
  /**
   * Optimistically advances the queue to the next card and records the result.
   * The network mutation (POST /api/v1/reviews/submit) fires separately from
   * a TanStack Query useMutation hook in the component — never from here.
   */
  submitRating: (rating: ReviewRating) => void
  endSession:   () => void
  reset:        () => void
}

// ── Combined store type ───────────────────────────────────────────────────────

type ReviewSessionStore = ReviewSessionState & { actions: ReviewSessionActions }

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: ReviewSessionState = {
  queue:          [],
  currentIndex:   0,
  showAnswer:     false,
  sessionHistory: [],
  sessionStarted: false,
  sessionId:      null,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useReviewSessionStore = create<ReviewSessionStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      actions: {
        startSession: (cards) =>
          set({
            queue:          cards,
            currentIndex:   0,
            showAnswer:     false,
            sessionHistory: [],
            sessionStarted: true,
            sessionId:      crypto.randomUUID(),
          }),

        flipCard: () => set({ showAnswer: true }),

        submitRating: (rating) => {
          const { currentIndex, queue, sessionHistory } = get()
          const currentCard = queue[currentIndex]
          // Guard: no-op if the queue is already exhausted.
          if (currentCard === undefined) return
          set({
            currentIndex:   currentIndex + 1,
            showAnswer:     false,
            sessionHistory: [...sessionHistory, { card: currentCard, rating }],
          })
        },

        endSession: () => set({ sessionStarted: false }),

        reset: () => set(initialState),
      },
    }),
    { name: 'ReviewSessionStore' },
  ),
)

// ── Selector hooks ────────────────────────────────────────────────────────────
// Components import these — never select the whole store.

export const useReviewQueue      = () => useReviewSessionStore((s) => s.queue)
export const useCurrentCard      = () => useReviewSessionStore((s) => s.queue[s.currentIndex])
export const useShowAnswer       = () => useReviewSessionStore((s) => s.showAnswer)
export const useSessionHistory   = () => useReviewSessionStore((s) => s.sessionHistory)
export const useIsSessionStarted = () => useReviewSessionStore((s) => s.sessionStarted)
export const useSessionId        = () => useReviewSessionStore((s) => s.sessionId)
export const useSessionActions   = () => useReviewSessionStore((s) => s.actions)
