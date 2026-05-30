"use client";

import type { ApiWeakSpotDrillAttemptResult, SubmitReviewInput } from "@fsrs-japanese/shared-types";
import { useEffect } from "react";

type RealReviewRating = SubmitReviewInput["rating"];

/**
 * Keyboard routing for the active drill session, extracted from
 * `drill-session-client.tsx`. Suppressed while focus is inside a form control
 * or a modifier key is held.
 *
 * Two keymaps share the digit row by mode:
 *   - default     — Space/Enter reveals; 1/2/3 rate Missed/Hesitated/Remembered;
 *                   R opens the real-review override.
 *   - overrideOpen — the override panel hijacks the digits so 1/2/3/4 map to the
 *                   canonical Again/Hard/Good/Easy buttons; Esc cancels.
 */
export function useDrillSessionKeyboard({
	isActive,
	showAnswer,
	overrideOpen,
	onReveal,
	onRate,
	onOpenOverride,
	onCancelOverride,
	onSubmitAsReview,
}: {
	isActive: boolean;
	showAnswer: boolean;
	overrideOpen: boolean;
	onReveal: () => void;
	onRate: (result: ApiWeakSpotDrillAttemptResult) => void;
	onOpenOverride: () => void;
	onCancelOverride: () => void;
	onSubmitAsReview: (rating: RealReviewRating) => void;
}): void {
	useEffect(() => {
		function onKey(e: KeyboardEvent): void {
			if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey)
				return;
			if (e.target instanceof HTMLInputElement)
				return;
			if (e.target instanceof HTMLTextAreaElement)
				return;
			if (e.target instanceof HTMLSelectElement)
				return;
			if (e.target instanceof HTMLElement && e.target.isContentEditable)
				return;
			if (!isActive)
				return;
			if ((e.key === " " || e.key === "Enter") && !showAnswer) {
				e.preventDefault();
				onReveal();
				return;
			}
			if (!showAnswer)
				return;
			// Override panel hijacks the keymap while open so digits 1-4 map to
			// the canonical rating buttons rather than the drill bar's 1-3.
			if (overrideOpen) {
				if (e.key === "Escape") { e.preventDefault(); onCancelOverride(); } else if (e.key === "1") { e.preventDefault(); onSubmitAsReview("again"); } else if (e.key === "2") { e.preventDefault(); onSubmitAsReview("hard"); } else if (e.key === "3") { e.preventDefault(); onSubmitAsReview("good"); } else if (e.key === "4") { e.preventDefault(); onSubmitAsReview("easy"); }
				return;
			}
			if (e.key === "1") { e.preventDefault(); onRate("missed"); } else if (e.key === "2") { e.preventDefault(); onRate("hesitated"); } else if (e.key === "3") { e.preventDefault(); onRate("remembered"); } else if (e.key === "r" || e.key === "R") { e.preventDefault(); onOpenOverride(); }
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isActive, showAnswer, overrideOpen, onReveal, onRate, onOpenOverride, onCancelOverride, onSubmitAsReview]);
}
