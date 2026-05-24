import { create } from 'zustand'
import { persist, createJSONStorage, devtools } from 'zustand/middleware'

import { useReviewSessionStore } from './useReviewSessionStore'

// ── Tuning shape ────────────────────────────────────────────────────────────
//
// Review Setup is an *optional* tuning surface (see
// docs/information_architecture/02_review_setup.md). Choices apply to the
// next session only, never to deck defaults. Saving as default is intentionally
// not modeled here — it lives in Settings / Deck Options.
//
// Persistence: sessionStorage. Survives a page refresh during an interrupted
// session so the learner doesn't lose their tuning, but auto-clears the
// moment the review session transitions to 'finished'.

export type ReviewOrder    = 'urgency' | 'shuffle' | 'difficulty'
export type NewCardOrder   = 'deck-order' | 'shuffle' | 'frequency'
export type TimeboxMinutes = null | 5 | 10 | 15 | 20 | 30

export interface SessionTuning {
  // Session
  includeNewCards: boolean
  sessionSize:     number  // 0 = no cap
  // Decks
  includedDeckIds: ReadonlyArray<string> | null  // null = all decks
  // Order
  reviewOrder:     ReviewOrder
  newCardOrder:    NewCardOrder
  overdueFirst:    boolean  // isolation: backlog-only this session
  // Advanced
  timeboxMinutes:  TimeboxMinutes
  buryRelated:     boolean
}

export const DEFAULT_TUNING: SessionTuning = {
  includeNewCards: true,
  sessionSize:     0,
  includedDeckIds: null,
  reviewOrder:     'urgency',
  newCardOrder:    'deck-order',
  overdueFirst:    false,
  timeboxMinutes:  null,
  buryRelated:     false,
}

// ── Diff helpers ─────────────────────────────────────────────────────────────

function arrayEq(
  a: ReadonlyArray<string> | null,
  b: ReadonlyArray<string> | null,
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function tuningIsModified(t: SessionTuning): boolean {
  return (
    t.includeNewCards !== DEFAULT_TUNING.includeNewCards ||
    t.sessionSize     !== DEFAULT_TUNING.sessionSize     ||
    !arrayEq(t.includedDeckIds, DEFAULT_TUNING.includedDeckIds) ||
    t.reviewOrder     !== DEFAULT_TUNING.reviewOrder     ||
    t.newCardOrder    !== DEFAULT_TUNING.newCardOrder    ||
    t.overdueFirst    !== DEFAULT_TUNING.overdueFirst    ||
    t.timeboxMinutes  !== DEFAULT_TUNING.timeboxMinutes  ||
    t.buryRelated     !== DEFAULT_TUNING.buryRelated
  )
}

// ── Store ───────────────────────────────────────────────────────────────────

interface SessionTuningActions {
  set:   <K extends keyof SessionTuning>(key: K, value: SessionTuning[K]) => void
  reset: () => void
  /** Replace all tuning values at once. Used to reset to a user-saved baseline
   *  (see useTuningDefaultsStore) instead of the hardcoded DEFAULT_TUNING. */
  applyTuning: (tuning: SessionTuning) => void
}

type SessionTuningStore = SessionTuning & { actions: SessionTuningActions }

export const useSessionTuningStore = create<SessionTuningStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...DEFAULT_TUNING,
        actions: {
          set:         (key, value) => set({ ...get(), [key]: value }),
          reset:       () => set({ ...get(), ...DEFAULT_TUNING }),
          applyTuning: (tuning)     => set({ ...get(), ...tuning }),
        },
      }),
      {
        name:    'tomo.session-tuning',
        storage: createJSONStorage(() => {
          if (typeof window === 'undefined') {
            // SSR — return a no-op shim.
            return {
              getItem:    () => null,
              setItem:    () => undefined,
              removeItem: () => undefined,
            }
          }
          return window.sessionStorage
        }),
        // Don't persist actions.
        partialize: (s) => ({
          includeNewCards: s.includeNewCards,
          sessionSize:     s.sessionSize,
          includedDeckIds: s.includedDeckIds,
          reviewOrder:     s.reviewOrder,
          newCardOrder:    s.newCardOrder,
          overdueFirst:    s.overdueFirst,
          timeboxMinutes:  s.timeboxMinutes,
          buryRelated:     s.buryRelated,
        }),
      },
    ),
    { name: 'SessionTuningStore' },
  ),
)

// ── Auto-clear on session completion ────────────────────────────────────────
//
// When the review session transitions to 'finished' (i.e. the learner reached
// /review/summary), wipe the tuning. This keeps "today's choices stay for
// today's session" honest: the next setup visit reads pristine defaults.
//
// We guard with typeof window so SSR is unaffected.

if (typeof window !== 'undefined') {
  let previousPhase: string = useReviewSessionStore.getState().phase
  useReviewSessionStore.subscribe((state) => {
    if (state.phase === 'finished' && previousPhase !== 'finished') {
      useSessionTuningStore.getState().actions.reset()
    }
    previousPhase = state.phase
  })
}
