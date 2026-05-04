import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

// ── Domain types ──────────────────────────────────────────────────────────────

// 'beginner' is a UI-only value. The DB jlpt_level enum has no 'beginner' entry
// (valid values: N5, N4, N3, N2, N1, beyond_jlpt). When POSTing to the profile
// API, map 'beginner' → 'N5' (the lowest valid JLPT level).
export type OnboardingLevel    = 'beginner' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type OnboardingGoal     = 'jlpt' | 'anime_manga' | 'novels' | 'life_work'
export type OnboardingSchedule = 'light' | 'steady' | 'intensive'

// ── Step routing constants ────────────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  '/onboarding/level',
  '/onboarding/goal',
  '/onboarding/interests',
  '/onboarding/schedule',
  '/onboarding/decks',
] as const

export type OnboardingStepPath = (typeof ONBOARDING_STEPS)[number]

export const ONBOARDING_STEP_INDEX: Record<OnboardingStepPath, number> = {
  '/onboarding/level':     0,
  '/onboarding/goal':      1,
  '/onboarding/interests': 2,
  '/onboarding/schedule':  3,
  '/onboarding/decks':     4,
}

export const NEXT_STEP: Record<OnboardingStepPath, string> = {
  '/onboarding/level':     '/onboarding/goal',
  '/onboarding/goal':      '/onboarding/interests',
  '/onboarding/interests': '/onboarding/schedule',
  '/onboarding/schedule':  '/onboarding/decks',
  '/onboarding/decks':     '/dashboard',
}

// ── Store shape ───────────────────────────────────────────────────────────────

interface OnboardingAnswers {
  level:           OnboardingLevel | null
  goal:            OnboardingGoal | null
  interests:       string[]
  schedule:        OnboardingSchedule | null
  selectedDeckIds: string[]
}

interface OnboardingState extends OnboardingAnswers {
  actions: {
    setLevel:           (level: OnboardingLevel) => void
    setGoal:            (goal: OnboardingGoal) => void
    setInterests:       (interests: string[]) => void
    toggleInterest:     (interest: string) => void
    setSchedule:        (schedule: OnboardingSchedule) => void
    setSelectedDeckIds: (ids: string[]) => void
    /** Applies the sensible default for a single step and advances navigation. */
    applyStepDefault:   (step: OnboardingStepPath) => void
    /** Applies defaults for every answer that hasn't been set yet. */
    applyAllDefaults:   () => void
    reset:              () => void
  }
}

// ── Sensible defaults per step ────────────────────────────────────────────────

function stepDefault(step: OnboardingStepPath): Partial<OnboardingAnswers> {
  switch (step) {
    case '/onboarding/level':     return { level: 'N5' }
    case '/onboarding/goal':      return { goal: 'jlpt' }
    case '/onboarding/interests': return { interests: [] }
    case '/onboarding/schedule':  return { schedule: 'steady' }
    case '/onboarding/decks':     return { selectedDeckIds: [] }
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

const initial: OnboardingAnswers = {
  level:           null,
  goal:            null,
  interests:       [],
  schedule:        null,
  selectedDeckIds: [],
}

export const useOnboardingStore = create<OnboardingState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initial,
        actions: {
          setLevel:           (level)    => set({ level }),
          setGoal:            (goal)     => set({ goal }),
          setInterests:       (interests)=> set({ interests }),
          setSchedule:        (schedule) => set({ schedule }),
          setSelectedDeckIds: (ids)      => set({ selectedDeckIds: ids }),

          toggleInterest: (interest) =>
            set((s) => ({
              interests: s.interests.includes(interest)
                ? s.interests.filter((i) => i !== interest)
                : [...s.interests, interest],
            })),

          applyStepDefault: (step) => set(stepDefault(step)),

          applyAllDefaults: () => {
            const s = get()
            set({
              level:    s.level    ?? 'N5',
              goal:     s.goal     ?? 'jlpt',
              schedule: s.schedule ?? 'steady',
            })
          },

          reset: () => set(initial),
        },
      }),
      {
        name: 'fsrs-onboarding',
        storage: createJSONStorage(() => {
          // sessionStorage is only available in the browser; return a no-op
          // storage during SSR to prevent hydration mismatches.
          if (typeof window === 'undefined') {
            return {
              getItem:    () => null,
              setItem:    () => undefined,
              removeItem: () => undefined,
            }
          }
          return sessionStorage
        }),
        // Never serialize `actions` — functions are not serializable.
        partialize: ({ actions: _a, ...rest }) => rest,
      },
    ),
    { name: 'OnboardingStore' },
  ),
)
