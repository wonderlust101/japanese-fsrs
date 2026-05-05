import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Profile } from '@fsrs-japanese/shared-types'

// ── Store shape ───────────────────────────────────────────────────────────────
//
// Four phases:
//   idle       — no profile, not fetching.
//   loading    — fetching for the first time (no stale data to show).
//   loaded     — profile present, no in-flight fetch.
//   refreshing — profile present, refetching with stale data still visible.
//
// Modeling these as a discriminated union prevents the four invalid combos a
// flat `{ profile: Profile | null; isLoading: boolean }` would permit.

interface IdleState       { status: 'idle' }
interface LoadingState    { status: 'loading' }
interface LoadedState     { status: 'loaded';     profile: Profile }
interface RefreshingState { status: 'refreshing'; profile: Profile }

type UserStatusState = IdleState | LoadingState | LoadedState | RefreshingState

interface UserActions {
  /** Marks the profile as loaded; future loads with this profile become 'refreshing'. */
  setProfile:        (profile: Profile) => void
  /** Toggle in-flight state. Profile presence chooses loading↔idle vs refreshing↔loaded. */
  setLoading:        (loading: boolean) => void
  /** Shallow-merges new fields into the existing profile. No-op if no profile is loaded. */
  updatePreferences: (prefs: Partial<Profile>) => void
  /** Returns to idle. Called before a new signup to flush stale data. */
  reset:             () => void
}

type UserStore = UserStatusState & { actions: UserActions }

// ── Store ─────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserStore>()(
  devtools(
    (set, get) => ({
      status: 'idle',

      actions: {
        setProfile: (profile) =>
          set({ status: 'loaded', profile, actions: get().actions }, true),

        setLoading: (loading) => {
          const s = get()
          if (loading) {
            switch (s.status) {
              case 'idle':
              case 'loading':
                set({ status: 'loading', actions: s.actions }, true)
                return
              case 'loaded':
              case 'refreshing':
                set({ status: 'refreshing', profile: s.profile, actions: s.actions }, true)
                return
              default: {
                const _exhaustiveCheck: never = s
                throw new Error(`Unhandled user state: ${JSON.stringify(_exhaustiveCheck)}`)
              }
            }
          }
          switch (s.status) {
            case 'idle':
            case 'loading':
              set({ status: 'idle', actions: s.actions }, true)
              return
            case 'loaded':
            case 'refreshing':
              set({ status: 'loaded', profile: s.profile, actions: s.actions }, true)
              return
            default: {
              const _exhaustiveCheck: never = s
              throw new Error(`Unhandled user state: ${JSON.stringify(_exhaustiveCheck)}`)
            }
          }
        },

        updatePreferences: (prefs) => {
          const s = get()
          if (s.status !== 'loaded' && s.status !== 'refreshing') return
          const merged: Profile = { ...s.profile, ...prefs }
          set({ status: s.status, profile: merged, actions: s.actions }, true)
        },

        reset: () => set({ status: 'idle', actions: get().actions }, true),
      },
    }),
    { name: 'UserStore' },
  ),
)
