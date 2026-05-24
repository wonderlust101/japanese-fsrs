import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

// Dev-only overrides that let the session dev tools dock paint visual states
// the live data wouldn't normally produce (offline, sync error, post-reveal,
// bootstrap failure).
//
// The store exists in every build but is only mutated by the dev dock
// (`apps/web/app/(app)/review/session/_components/session-dev-tools-dock.tsx`),
// which is gated to `process.env.NODE_ENV !== 'production'`. In production the
// defaults stand and the production review path is untouched.

export interface SessionDevOverrides {
  forceShowAnswer:      boolean
  forceOffline:         boolean
  forceSyncError:       boolean
  forceBootstrapFailed: boolean
  /** Pin the page on the brushy "Preparing your reviews" PageLoader so
   *  designers can preview the bootstrap state without throttling network. */
  forceBootstrapping:   boolean
  /** Pin the page on the "Wrapping up" PageLoader (the end-of-session
   *  transition that fires after the last card is rated). */
  forceEndingSession:   boolean
  prefersReducedMotion: boolean
}

interface SessionDevOverridesActions {
  set:   <K extends keyof SessionDevOverrides>(key: K, value: SessionDevOverrides[K]) => void
  reset: () => void
}

type Store = SessionDevOverrides & { actions: SessionDevOverridesActions }

const DEFAULTS: SessionDevOverrides = {
  forceShowAnswer:      false,
  forceOffline:         false,
  forceSyncError:       false,
  forceBootstrapFailed: false,
  forceBootstrapping:   false,
  forceEndingSession:   false,
  prefersReducedMotion: false,
}

export const useSessionDevOverridesStore = create<Store>()((set, get) => ({
  ...DEFAULTS,
  actions: {
    set:   (key, value) => set({ [key]: value } as Partial<Store>),
    reset: () => set({ ...DEFAULTS, actions: get().actions }),
  },
}))

export const useSessionDevOverrides = (): SessionDevOverrides =>
  useSessionDevOverridesStore(useShallow((s) => ({
    forceShowAnswer:      s.forceShowAnswer,
    forceOffline:         s.forceOffline,
    forceSyncError:       s.forceSyncError,
    forceBootstrapFailed: s.forceBootstrapFailed,
    forceBootstrapping:   s.forceBootstrapping,
    forceEndingSession:   s.forceEndingSession,
    prefersReducedMotion: s.prefersReducedMotion,
  })))

export const useSessionDevOverridesActions = (): SessionDevOverridesActions =>
  useSessionDevOverridesStore((s) => s.actions)
