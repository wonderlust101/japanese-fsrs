"use client";

import { useEffect } from "react";

/**
 * Power-user keyboard parity with /today for the review-setup page:
 *   R / Enter — start the session (when previewable cards exist)
 *   S         — save the current tuning as the user's default (when modified)
 *
 * Suppressed when focus is inside a form control or a modifier key is held, so
 * segmented controls, checkboxes, and the deck list keep their own behavior.
 * Extracted from `setup-client.tsx`.
 */
export function useSetupKeyboard({ onStart, onSaveAsDefault, isLoading, previewActive, previewTotal, modified }: {
	onStart: () => void;
	onSaveAsDefault: () => void;
	isLoading: boolean;
	previewActive: boolean;
	previewTotal: number;
	modified: boolean;
}): void {
	useEffect(() => {
		function handleKey(event: KeyboardEvent): void {
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
				return;
			const target = event.target as HTMLElement | null;
			if (target !== null) {
				const tag = target.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
					return;
				if (target.isContentEditable)
					return;
			}
			const key = event.key.toLowerCase();
			if (key === "r" || key === "enter") {
				if (isLoading || previewActive || previewTotal === 0)
					return;
				event.preventDefault();
				onStart();
				return;
			}
			if (key === "s") {
				if (!modified || previewActive)
					return;
				event.preventDefault();
				onSaveAsDefault();
			}
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onStart, onSaveAsDefault, isLoading, previewActive, previewTotal, modified]);
}
