"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Page-level keyboard shortcuts for the card-detail view: `E` edits the card
 * (no-op on premade source cards), `Shift+M` toggles the memory/scheduling
 * popup. Bare `M` is the in-card mnemonic tab, so memory takes `Shift+M`.
 * Suppressed while typing or while any dialog is open.
 *
 * Takes the stable `setShowHistory` setter (not an inline toggle) so the effect
 * doesn't re-bind every render. Extracted from `card-detail-view.tsx`.
 */
export function useCardDetailShortcuts({ editHref, isPremadeSource, setShowHistory }: {
	editHref: string;
	isPremadeSource: boolean;
	setShowHistory: Dispatch<SetStateAction<boolean>>;
}): void {
	const router = useRouter();

	useEffect(() => {
		function onKey(e: KeyboardEvent): void {
			if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing)
				return;
			const t = e.target as HTMLElement | null;
			if (t !== null && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
				return;
			if (typeof document !== "undefined" && document.querySelector("dialog[open]") !== null)
				return;

			const key = e.key.toLowerCase();
			if (e.shiftKey && key === "m") {
				e.preventDefault();
				setShowHistory(v => !v);
				return;
			}
			if (!e.shiftKey && key === "e" && !isPremadeSource) {
				e.preventDefault();
				router.push(editHref);
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [router, editHref, isPremadeSource, setShowHistory]);
}
