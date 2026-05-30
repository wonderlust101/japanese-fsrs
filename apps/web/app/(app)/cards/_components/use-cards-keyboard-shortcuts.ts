"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Page-level keyboard shortcuts for the cards browser: `F` opens the add-filter
 * popover, `V` opens the saved-view picker. Both are lifted to the page so the
 * bindings work without prop-drilling refs through the toolbar; the popover
 * open-state and a synthetic click-ref for the view trigger are returned for
 * the toolbar to consume.
 *
 * Guards against firing while the user is typing in an input/textarea/
 * contentEditable, and ignores modified keys so Cmd-F still triggers browser
 * find. Documented in `components/help/HelpDialog.tsx`.
 */
export function useCardsKeyboardShortcuts(): {
	addFilterOpen: boolean;
	setAddFilterOpen: Dispatch<SetStateAction<boolean>>;
	viewTriggerClickRef: RefObject<(() => void) | null>;
} {
	const [addFilterOpen, setAddFilterOpen] = useState(false);
	const viewTriggerClickRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		function onKey(e: KeyboardEvent): void {
			// Ignore modified keys (Cmd-F should still trigger browser find).
			if (e.metaKey || e.ctrlKey || e.altKey)
				return;
			const active = document.activeElement;
			if (active instanceof HTMLElement) {
				const tag = active.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA")
					return;
				if (active.isContentEditable)
					return;
			}
			if (e.key === "f" || e.key === "F") {
				e.preventDefault();
				setAddFilterOpen(true);
				return;
			}
			if (e.key === "v" || e.key === "V") {
				e.preventDefault();
				viewTriggerClickRef.current?.();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return { addFilterOpen, setAddFilterOpen, viewTriggerClickRef };
}
