import { create }    from 'zustand'
import { persist }   from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

// Per-learner preferences for the Review Session surface. Persisted to
// localStorage so the next session opens in the state the learner left it.
// Lives separately from the broader `useSessionTuningStore` (which is about
// what cards get queued) and from `useReviewSessionStore` (which is the live
// in-flight session). Keep this small and presentation-only.

export type FuriganaMode = 'hover' | 'always' | 'off'

export interface SessionPreferences {
  audioMuted:   boolean
  furiganaMode: FuriganaMode
  // Definition panel tab the learner most recently used. Resets per card by
  // the ReviewCard orchestrator so each card opens on the primary definition.
  activeDefTab: string
}

interface SessionPreferencesActions {
  setAudioMuted:   (v: boolean) => void
  setFuriganaMode: (v: FuriganaMode) => void
  setActiveDefTab: (v: string) => void
}

type Store = SessionPreferences & { actions: SessionPreferencesActions }

const DEFAULTS: SessionPreferences = {
  audioMuted:   false,
  furiganaMode: 'hover',
  activeDefTab: 'definition',
}

export const useSessionPreferencesStore = create<Store>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      actions: {
        setAudioMuted:   (v) => set({ audioMuted: v }),
        setFuriganaMode: (v) => set({ furiganaMode: v }),
        setActiveDefTab: (v) => set({ activeDefTab: v }),
      },
    }),
    {
      name: 'tomo.session.preferences',
      // Don't persist activeDefTab; it's a session-local concern.
      partialize: (s) => ({ audioMuted: s.audioMuted, furiganaMode: s.furiganaMode }),
    },
  ),
)

export const useSessionPreferences = (): SessionPreferences =>
  useSessionPreferencesStore(useShallow((s) => ({
    audioMuted:   s.audioMuted,
    furiganaMode: s.furiganaMode,
    activeDefTab: s.activeDefTab,
  })))

export const useSessionPreferencesActions = (): SessionPreferencesActions =>
  useSessionPreferencesStore((s) => s.actions)
