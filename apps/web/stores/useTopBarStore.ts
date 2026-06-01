import type React from "react";
import { create } from "zustand";

export interface TopBarOverride {
	kanji?: string;
	label?: string;
	labelLang?: string;
	backHref?: string;
	backAriaLabel?: string;
	desktopHidden?: boolean;
	actions?: React.ReactNode;
}

interface TopBarStore {
	override: TopBarOverride | null;
	setOverride: (override: TopBarOverride | null) => void;
}

export const useTopBarStore = create<TopBarStore>(set => ({
	override: null,
	setOverride: override => set({ override }),
}));
