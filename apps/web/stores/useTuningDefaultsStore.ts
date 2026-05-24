import { create } from 'zustand'
import { persist, createJSONStorage, devtools } from 'zustand/middleware'

import { DEFAULT_TUNING, type SessionTuning } from './useSessionTuningStore'

// ── User-default tuning ──────────────────────────────────────────────────────
//
// Persists in localStorage (vs the per-session tuning store which lives in
// sessionStorage and auto-wipes on session-finish). When set, this becomes
// the new baseline for "modified" comparisons and the target of Reset on
// /review/setup. When unset, hardcoded DEFAULT_TUNING is the baseline.
//
// Surfaced by the "Save as default" link in the setup page's action area.

interface TuningDefaultsState {
  /** User-saved tuning defaults, or null when the learner hasn't saved any. */
  userDefault: SessionTuning | null
  actions: {
    save:  (tuning: SessionTuning) => void
    clear: () => void
  }
}

export const useTuningDefaultsStore = create<TuningDefaultsState>()(
  devtools(
    persist(
      (set) => ({
        userDefault: null,
        actions: {
          save:  (tuning) => set({ userDefault: tuning }),
          clear: () => set({ userDefault: null }),
        },
      }),
      {
        name:    'tomo.session.tuning-default',
        storage: createJSONStorage(() => {
          if (typeof window === 'undefined') {
            return {
              getItem:    () => null,
              setItem:    () => undefined,
              removeItem: () => undefined,
            }
          }
          return window.localStorage
        }),
        partialize: (s) => ({ userDefault: s.userDefault }),
      },
    ),
    { name: 'TuningDefaultsStore' },
  ),
)

// ── Baseline + modified-check helpers ───────────────────────────────────────

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

/** The active baseline: user-saved default if any, else DEFAULT_TUNING. */
export function activeBaseline(userDefault: SessionTuning | null): SessionTuning {
  return userDefault ?? DEFAULT_TUNING
}

/** Compare against the active baseline (user default if present, hardcoded default otherwise). */
export function tuningDiffersFromBaseline(
  tuning:   SessionTuning,
  baseline: SessionTuning,
): boolean {
  return (
    tuning.includeNewCards !== baseline.includeNewCards ||
    tuning.sessionSize     !== baseline.sessionSize     ||
    !arrayEq(tuning.includedDeckIds, baseline.includedDeckIds) ||
    tuning.reviewOrder     !== baseline.reviewOrder     ||
    tuning.newCardOrder    !== baseline.newCardOrder    ||
    tuning.overdueFirst    !== baseline.overdueFirst    ||
    tuning.timeboxMinutes  !== baseline.timeboxMinutes  ||
    tuning.buryRelated     !== baseline.buryRelated
  )
}
