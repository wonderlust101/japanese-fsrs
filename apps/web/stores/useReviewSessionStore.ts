import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

import { randomUUID } from '@/lib/random-uuid'

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
  /** UUID of the persisted `review_logs` row, captured from the submit-review
   *  response. Null until the server replies (the rating is appended locally
   *  immediately, before the deferred API call fires). The Review Summary uses
   *  this to offer per-card rollback within the just-finished session. */
  reviewLogId?: string | null
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
  startSession:    (cards: ApiDueCard[]) => void
  flipCard:        () => void
  submitRating:    (rating: UserRating) => void
  undoLastRating:  () => void
  /** Patches the most recent history entry for `cardId` with the server-
   *  returned `reviewLogId`. Called from the page after the submit-review
   *  mutation resolves. No-op if the entry has already been replaced (e.g.
   *  by undo) — the rollback affordance simply won't appear for that card. */
  attachReviewLogId: (cardId: string, reviewLogId: string) => void
  endSession:      () => void
  reset:           () => void
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
            sessionId:      randomUUID(),
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

        undoLastRating: () => {
          // Rewinds the local session state by one rating. Coordinated with
          // the page's 3-second deferred-submit timer so the API call is
          // cancelled (never fired) — no rollback endpoint required.
          const s = get()
          if (s.phase !== 'active') return
          if (s.sessionHistory.length === 0) return
          if (s.currentIndex === 0) return
          set({
            ...s,
            currentIndex:   s.currentIndex - 1,
            // The previous card was rated, which means it had been revealed.
            // Restore that state so the rating bar is immediately usable.
            showAnswer:     true,
            sessionHistory: s.sessionHistory.slice(0, -1),
          }, true)
        },

        attachReviewLogId: (cardId, reviewLogId) => {
          // Patch the most recent history entry that matches `cardId`. Search
          // from the tail because that's where the just-submitted review is;
          // searching from the head would mis-attach if the same card was
          // rated more than once in a session (rare, but possible).
          const s = get()
          if (s.phase !== 'active' && s.phase !== 'finished') return
          const next = s.sessionHistory.slice()
          for (let i = next.length - 1; i >= 0; i -= 1) {
            const entry = next[i]
            if (entry !== undefined && entry.card.id === cardId && entry.reviewLogId == null) {
              next[i] = { ...entry, reviewLogId }
              set({ ...s, sessionHistory: next }, true)
              return
            }
          }
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

// Stable references for the "phase doesn't match" fallback path. A fresh `[]`
// literal in a Zustand selector triggers React's useSyncExternalStore loop
// detection ("getServerSnapshot should be cached") because every render
// produces a new reference.
const EMPTY_QUEUE:   readonly ApiDueCard[]         = []
const EMPTY_HISTORY: readonly SessionHistoryEntry[] = []

export const useReviewQueue      = (): readonly ApiDueCard[] =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.queue : EMPTY_QUEUE))

export const useCurrentCard      = (): ApiDueCard | undefined =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.queue[s.currentIndex] : undefined))

export const useCurrentIndex     = (): number =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.currentIndex : 0))

export const useShowAnswer       = (): boolean =>
  useReviewSessionStore((s) => (s.phase === 'active' ? s.showAnswer : false))

export const useSessionHistory   = (): readonly SessionHistoryEntry[] =>
  useReviewSessionStore((s) =>
    s.phase === 'active' || s.phase === 'finished'
      ? s.sessionHistory
      : EMPTY_HISTORY,
  )

export const useIsSessionStarted = (): boolean =>
  useReviewSessionStore((s) => s.phase === 'active')

export const useSessionId        = (): string | null =>
  useReviewSessionStore((s) =>
    s.phase === 'active' || s.phase === 'finished' ? s.sessionId : null,
  )

export const useSessionActions   = (): ReviewSessionActions =>
  useReviewSessionStore((s) => s.actions)

// ── Resume context ────────────────────────────────────────────────────────────
// Today reads this to decide whether to render the 'resume' hero variant. Only
// `phase === 'active'` counts — `finished` has no cards left to review.

export interface ResumeContext {
  sessionId: string
  remaining: number
}

// useShallow: the projection builds a fresh object literal when the session
// is active, and `useSyncExternalStore` would otherwise see every call as a
// new snapshot and trigger React's tearing-detection loop ("Maximum update
// depth exceeded"). The shallow comparator caches the projected reference
// when sessionId + remaining are unchanged.
export const useResumeContext = (): ResumeContext | null =>
  useReviewSessionStore(
    useShallow((s) => {
      if (s.phase !== 'active') return null
      const remaining = Math.max(0, s.queue.length - s.currentIndex)
      if (remaining === 0) return null
      return { sessionId: s.sessionId, remaining }
    }),
  )
