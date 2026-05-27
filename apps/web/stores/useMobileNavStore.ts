import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface MobileNavState {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
}

/**
 * Owns the open/closed state of the mobile navigation drawer. Read by the
 * TopBar (hamburger button) and the MobileDrawer (overlay surface). Decoupled
 * via Zustand so the trigger and the overlay don't have to share a parent
 * client component.
 */
export const useMobileNavStore = create<MobileNavState>()(
	devtools(
		set => ({
			isOpen: false,
			open: () => set({ isOpen: true }, false, "mobileNav/open"),
			close: () => set({ isOpen: false }, false, "mobileNav/close"),
			toggle: () => set(s => ({ isOpen: !s.isOpen }), false, "mobileNav/toggle"),
		}),
		{ name: "mobileNav" },
	),
);
