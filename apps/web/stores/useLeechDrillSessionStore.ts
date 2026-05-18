import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

import { randomUUID } from '@/lib/random-uuid'

import type {
  ApiLeechDrillAttemptResult,
  ApiLeechDrillSessionDetailCard,
} from '@fsrs-japanese/shared-types'

// ── State (discriminated by phase) ────────────────────────────────────────────
//
// Mirrors `useReviewSessionStore`'s phase model so the two surfaces stay
// learnable together. Differences:
//   - Attempts are recorded as drill-namespace events (not review_logs).
//   - Each attempt carries its own `eventId` (UUID) used as the backend's
//     idempotency key. A network retry with the same eventId returns the
//     original row without a second insert.
//   - There is no shown→answered timestamp inside the store; the page that
//     owns the timer passes `responseTimeMs` into `recordAttempt`.
//
// Phases:
//   idle     — no session, no leftover data.
//   active   — a drill is running.
//   finished — endSession() called; queue + attempts preserved for the
//              summary page, regardless of whether all cards were attempted.

export interface DrillAttemptRecord {
  eventId:        string
  sessionCardId:  string
  leechId:        string | null
  cardId:         string | null
  result:         ApiLeechDrillAttemptResult
  shownAt:        string
  answeredAt:     string
  responseTimeMs: number
  countedAsReview: boolean
}

interface IdleState {
  phase: 'idle'
}

interface ActiveState {
  phase:         'active'
  sessionId:     string
  queue:         ApiLeechDrillSessionDetailCard[]
  currentIndex:  number
  showAnswer:    boolean
  attempts:      DrillAttemptRecord[]
  /** Captured when the card first reveals (or is shown). Used to compute
   *  responseTimeMs when the learner rates. */
  cardShownAt:   number
}

interface FinishedState {
  phase:        'finished'
  sessionId:    string
  queue:        ApiLeechDrillSessionDetailCard[]
  attempts:     DrillAttemptRecord[]
  exitedEarly:  boolean
}

export type LeechDrillSessionState = IdleState | ActiveState | FinishedState

// ── Actions ───────────────────────────────────────────────────────────────────

interface LeechDrillSessionActions {
  /** Initialize a drill from a fetched session detail. */
  startSession:       (sessionId: string, queue: ApiLeechDrillSessionDetailCard[]) => void
  flipCard:           () => void
  recordAttempt:      (result: ApiLeechDrillAttemptResult, countedAsReview: boolean) => DrillAttemptRecord | null
  undoLastAttempt:    () => void
  /** Reset the shown timestamp — used after `recordAttempt` advances. */
  markCardShown:      () => void
  endSession:         (exitedEarly: boolean) => void
  reset:              () => void
}

type LeechDrillSessionStore = LeechDrillSessionState & { actions: LeechDrillSessionActions }

// ── Store ─────────────────────────────────────────────────────────────────────

export const useLeechDrillSessionStore = create<LeechDrillSessionStore>()(
  devtools(
    (set, get) => ({
      phase: 'idle',

      actions: {
        startSession: (sessionId, queue) =>
          set({
            phase:        'active',
            sessionId,
            queue,
            currentIndex: 0,
            showAnswer:   false,
            attempts:     [],
            cardShownAt:  Date.now(),
            actions:      get().actions,
          }, true),

        flipCard: () => {
          const s = get()
          if (s.phase !== 'active') return
          // Re-capture the shown moment as the reveal — gives a tighter
          // response-time signal anchored to when the answer actually came
          // into view rather than when the card first mounted.
          set({ ...s, showAnswer: true, cardShownAt: Date.now() }, true)
        },

        recordAttempt: (result, countedAsReview) => {
          const s = get()
          if (s.phase !== 'active') return null
          const card = s.queue[s.currentIndex]
          if (card === undefined) return null

          const answeredAt = Date.now()
          const record: DrillAttemptRecord = {
            eventId:         randomUUID(),
            sessionCardId:   card.sessionCardId,
            leechId:         card.leechId,
            cardId:          card.cardId,
            result,
            shownAt:         new Date(s.cardShownAt).toISOString(),
            answeredAt:      new Date(answeredAt).toISOString(),
            responseTimeMs:  Math.max(0, answeredAt - s.cardShownAt),
            countedAsReview,
          }

          set({
            ...s,
            currentIndex: s.currentIndex + 1,
            showAnswer:   false,
            attempts:     [...s.attempts, record],
            cardShownAt:  answeredAt,
          }, true)
          return record
        },

        undoLastAttempt: () => {
          const s = get()
          if (s.phase !== 'active') return
          if (s.attempts.length === 0) return
          if (s.currentIndex === 0) return
          set({
            ...s,
            currentIndex: s.currentIndex - 1,
            // The previous card was rated, meaning the back was visible.
            // Restore that state so the rating bar is immediately usable.
            showAnswer:   true,
            attempts:     s.attempts.slice(0, -1),
            cardShownAt:  Date.now(),
          }, true)
        },

        markCardShown: () => {
          const s = get()
          if (s.phase !== 'active') return
          set({ ...s, cardShownAt: Date.now() }, true)
        },

        endSession: (exitedEarly) => {
          const s = get()
          if (s.phase !== 'active') return
          set({
            phase:        'finished',
            sessionId:    s.sessionId,
            queue:        s.queue,
            attempts:     s.attempts,
            exitedEarly,
            actions:      s.actions,
          }, true)
        },

        reset: () => set({ phase: 'idle', actions: get().actions }, true),
      },
    }),
    { name: 'LeechDrillSessionStore' },
  ),
)

// ── Selector hooks ────────────────────────────────────────────────────────────

const EMPTY_QUEUE:    readonly ApiLeechDrillSessionDetailCard[] = []
const EMPTY_ATTEMPTS: readonly DrillAttemptRecord[]             = []

export const useDrillSessionId = (): string | null =>
  useLeechDrillSessionStore((s) =>
    s.phase === 'active' || s.phase === 'finished' ? s.sessionId : null,
  )

export const useDrillQueue = (): readonly ApiLeechDrillSessionDetailCard[] =>
  useLeechDrillSessionStore((s) =>
    s.phase === 'active' || s.phase === 'finished' ? s.queue : EMPTY_QUEUE,
  )

export const useDrillCurrentCard = (): ApiLeechDrillSessionDetailCard | undefined =>
  useLeechDrillSessionStore((s) =>
    s.phase === 'active' ? s.queue[s.currentIndex] : undefined,
  )

export const useDrillCurrentIndex = (): number =>
  useLeechDrillSessionStore((s) => (s.phase === 'active' ? s.currentIndex : 0))

export const useDrillShowAnswer = (): boolean =>
  useLeechDrillSessionStore((s) => (s.phase === 'active' ? s.showAnswer : false))

export const useDrillAttempts = (): readonly DrillAttemptRecord[] =>
  useLeechDrillSessionStore((s) =>
    s.phase === 'active' || s.phase === 'finished' ? s.attempts : EMPTY_ATTEMPTS,
  )

export const useDrillIsActive = (): boolean =>
  useLeechDrillSessionStore((s) => s.phase === 'active')

export const useDrillIsFinished = (): boolean =>
  useLeechDrillSessionStore((s) => s.phase === 'finished')

export const useDrillExitedEarly = (): boolean =>
  useLeechDrillSessionStore((s) => (s.phase === 'finished' ? s.exitedEarly : false))

export const useDrillActions = (): LeechDrillSessionActions =>
  useLeechDrillSessionStore((s) => s.actions)
