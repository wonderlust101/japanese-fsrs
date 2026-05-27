import { create } from "zustand";

interface HelpDialogState {
	open: boolean;
	actions: {
		openHelp: () => void;
		closeHelp: () => void;
	};
}

const useHelpDialogStore = create<HelpDialogState>(set => ({
	open: false,
	actions: {
		openHelp: () => set({ open: true }),
		closeHelp: () => set({ open: false }),
	},
}));

export function useHelpDialogOpen(): boolean {
	return useHelpDialogStore(s => s.open);
}

export function useHelpDialogActions(): HelpDialogState["actions"] {
	return useHelpDialogStore(s => s.actions);
}
