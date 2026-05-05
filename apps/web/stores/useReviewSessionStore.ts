import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

import type { ApiDueCard, SubmitReviewInput } from '@fsrs-japanese/shared-types'

// User-grade rating (excludes 'manual'). The session store only ever holds
// user-submitted ratings, so we narrow here to match the API's submitReviewSchema
// — 'manual' is reserved for internal forget / reschedule operations.
type UserRating = SubmitReviewInput['rating']

// ── State (discriminated by phase) ────────────────────────────────────────────
//
// Three phases:
//   idle     — no session, no leftover data.
//   active   — a session is running; queue / currentIndex / showAnswer are live.
//   finished — endSession() was called; sessionId + history are preserved so
//              the summary page can fetch and the user can see their results.
//              reset() returns to idle.
//
// Modeling these as a discriminated union eliminates invalid combinations
// (e.g. sessionStarted=true with sessionId=null, or an idle store with a
// non-empty queue) at the type level.

interface SessionHistoryEntry {
  card:   ApiDueCard
  rating: UserRating
}

interface IdleState {
  phase: 'idle'
}

interface ActiveState {
  phase:          'active'
  sessionId:      string
  queue:          ApiDueCard[]
  currentIndex:   number
  showAnswer:     boolean
  sessionHistory: SessionHistoryEntry[]
}

interface FinishedState {
  phase:          'finished'
  sessionId:      string
  sessionHistory: SessionHistoryEntry[]
}

type ReviewSessionState = IdleState | ActiveState | FinishedState

// ── Actions ───────────────────────────────────────────────────────────────────

interface ReviewSessionActions {
  startSession: (cards: ApiDueCard[]) => void
  flipCard:     () => void
  submitRating: (rating: UserRating) => void
  endSession:   () => void
  reset:        () => void
}

type ReviewSessionStore = ReviewSessionState & { actions: ReviewSessionActions }

// ── Store ─────────────────────────────────────────────────────────────────────

export const useReviewSessionStore = create<ReviewSessionStore>()(
  devtools(
    (set, get) => ({
      phase: 'idle',

      actions: {
        startSession: (cards) =>
          set({
            phase:          'active',
            sessionId:      crypto.randomUUID(),
            queue:          cards,
            currentIndex:   0,
            showAnswer:     false,
            sessionHistory: [],
            actions:        get().actions,
          }, true),

        flipCard: () => {
          const s = get()
          if (s.phase !== 'active') return
          set({ ...s, showAnswer: true }, true)
        },

        submitRating: (rating) => {
          const s = get()
          if (s.phase !== 'active') return
          const currentCard = s.queue[s.currentIndex]
          if (currentCard === undefined) return
          set({
            ...s,
            currentIndex:   s.currentIndex + 1,
            showAnswer:     false,
            sessionHistory: [...s.sessionHistory, { card: currentCard, rating }],
          }, true)
        },

        endSession: () => {
          const s = get()
          if (s.phase !== 'active') return
          set({
            phase:          'finished',
            sessionId:      s.sessionId,
            sessionHistory: s.sessionHistory,
            actions:        s.actions,
          }, true)
        },

        reset: () => set({ phase: 'idle', actions: get().actions }, true),
      },
    }),
    { name: 'ReviewSessionStore' },
  ),
)

// ── Selector hooks ────────────────────────────────────────────────────────────
// Components import these — never select the whole store. Each hook narrows
// the discriminated union internally and projects a stable shape so callers
// don't have to discriminate themselves.

export const useReviewQueue      = (): ApiDueCard[] =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.queue : []))

export const useCurrentCard      = (): ApiDueCard | undefined =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.queue[s.currentIndex] : undefined))

export const useCurrentIndex     = (): number =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.currentIndex : 0))

export const useShowAnswer       = (): boolean =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.showAnswer : false))

export const useSessionHistory   = (): SessionHistoryEntry[] =>
  useReviewSessionStore((s) =>
    s.phase === 'active' || s.phase === 'finished' ? s.sessionHistory : [],
  )

export const useIsSessionStarted = (): boolean =>
  useReviewSessionStore((s) => s.phase === 'active')

export const useSessionId        = (): string | null =>
  useReviewSessionStore((s) =>
    s.phase === 'active' || s.phase === 'finished' ? s.sessionId : null,
  )

export const useSessionActions   = (): ReviewSessionActions =>
  useReviewSessionStore((s) => s.actions)
