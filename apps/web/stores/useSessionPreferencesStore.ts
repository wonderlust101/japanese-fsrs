import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

// Per-learner preferences for the Review Session surface. Persisted to
// localStorage so the next session opens in the state the learner left it.
// Lives separately from the broader `useSessionTuningStore` (which is about
// what cards get queued) and from `useReviewSessionStore` (which is the live
// in-flight session). Keep this small and presentation-only.

export type FuriganaMode = "hover" | "always" | "off";

export interface SessionPreferences {
	audioMuted: boolean;
	furiganaMode: FuriganaMode;
	/**
	 * When true, the sentence translation on the back of the card shows
	 *  unblurred from the moment the card flips. When false (default), the
	 *  translation is blurred until the user taps/clicks it. Defaulting to
	 *  blurred preserves the recall rep: read the Japanese first, guess the
	 *  meaning, then reveal.
	 */
	autoRevealTranslation: boolean;
	// Definition panel tab the learner most recently used. Resets per card by
	// the ReviewCard orchestrator so each card opens on the primary definition.
	activeDefTab: string;
}

interface SessionPreferencesActions {
	setAudioMuted: (v: boolean) => void;
	setFuriganaMode: (v: FuriganaMode) => void;
	setAutoRevealTranslation: (v: boolean) => void;
	setActiveDefTab: (v: string) => void;
}

type Store = SessionPreferences & { actions: SessionPreferencesActions };

const DEFAULTS: SessionPreferences = {
	audioMuted: false,
	furiganaMode: "hover",
	autoRevealTranslation: false,
	activeDefTab: "definition",
};

export const useSessionPreferencesStore = create<Store>()(
	persist(
		set => ({
			...DEFAULTS,
			actions: {
				setAudioMuted: v => set({ audioMuted: v }),
				setFuriganaMode: v => set({ furiganaMode: v }),
				setAutoRevealTranslation: v => set({ autoRevealTranslation: v }),
				setActiveDefTab: v => set({ activeDefTab: v }),
			},
		}),
		{
			name: "tomo.session.preferences",
			// Don't persist activeDefTab; it's a session-local concern.
			partialize: s => ({
				audioMuted: s.audioMuted,
				furiganaMode: s.furiganaMode,
				autoRevealTranslation: s.autoRevealTranslation,
			}),
		},
	),
);

export function useSessionPreferences(): SessionPreferences {
	return useSessionPreferencesStore(useShallow(s => ({
		audioMuted: s.audioMuted,
		furiganaMode: s.furiganaMode,
		autoRevealTranslation: s.autoRevealTranslation,
		activeDefTab: s.activeDefTab,
	})));
}

export function useSessionPreferencesActions(): SessionPreferencesActions {
	return useSessionPreferencesStore(s => s.actions);
}
