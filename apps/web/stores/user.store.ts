import { create } from 'zustand'
import type { Profile } from '@fsrs-japanese/shared-types'

// ── Store shape ───────────────────────────────────────────────────────────────

interface UserState {
  profile:   Profile | null
  isLoading: boolean
  actions: {
    setProfile:        (profile: Profile) => void
    setLoading:        (loading: boolean) => void
    updatePreferences: (prefs: Partial<Profile>) => void
    reset:             () => void
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>()((set) => ({
  profile:   null,
  isLoading: false,

  actions: {
    setProfile: (profile) =>
      set({ profile, isLoading: false }),

    setLoading: (isLoading) =>
      set({ isLoading }),

    // Shallow-merges only the provided keys — safe to call with any subset
    // of Profile fields (e.g. after a PATCH /profile response).
    updatePreferences: (prefs) =>
      set((s) => ({
        profile: s.profile ? { ...s.profile, ...prefs } : null,
      })),

    // Called before a new signup session to prevent stale data from a
    // previously authenticated user bleeding into the onboarding flow.
    reset: () => set({ profile: null, isLoading: false }),
  },
}))
