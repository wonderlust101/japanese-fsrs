"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "tomo.decks.matureExplainerSeen";

/**
 * First-visit popover that teaches the "Mature" concept by anchoring under
 * the Mature tab in `DecksTabs`. Read once from localStorage on mount; if
 * unseen, render the popover with a "Got it" dismiss. Dismiss writes the
 * flag and never re-fires.
 *
 * Positioning: reads the bounding rect of the `#decks-tab-mature` element
 * and the wrapper this component sits inside, so the popover slides under
 * the right tab regardless of where it lands in the tablist line.
 */
export function MatureExplainer({
	// Anchor element id. The DecksTabs Mature tab carries `id="decks-tab-mature"`.
	anchorId = "decks-tab-mature",
}: {
	anchorId?: string;
}): React.JSX.Element | null {
	const [visible, setVisible] = useState(false);
	const [coords, setCoords] = useState<{ left: number; top: number; arrowLeft: number } | null>(null);
	const dismissRef = useRef<HTMLButtonElement | null>(null);
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const bodyId = useId();

	// First-visit gate: only show when the flag isn't set. Run in effect
	// so SSR doesn't try to touch localStorage.
	useEffect(() => {
		try {
			const seen = window.localStorage.getItem(STORAGE_KEY);
			if (seen !== "1")
				setVisible(true);
		} catch {
			// Storage disabled (private mode, etc). Show once per session as a
			// graceful fallback; without the flag it'll show again next time,
			// which is acceptable given the popover is a one-sentence note.
			setVisible(true);
		}
	}, []);

	// Position the popover under the Mature tab. Recompute on resize.
	useLayoutEffect(() => {
		if (!visible)
			return;
		function reposition(): void {
			const anchor = document.getElementById(anchorId);
			const wrapper = wrapRef.current?.parentElement;
			if (anchor === null || wrapper == null)
				return;
			const anchorRect = anchor.getBoundingClientRect();
			const wrapperRect = wrapper.getBoundingClientRect();
			const popoverWidth = 280;
			// Center the popover under the anchor, clamped to the wrapper bounds
			// with an 8px gutter so it never clips the page edge on narrow screens.
			const anchorCenter = anchorRect.left + anchorRect.width / 2;
			const idealLeft = anchorCenter - wrapperRect.left - popoverWidth / 2;
			const maxLeft = wrapperRect.width - popoverWidth - 8;
			const clampedLeft = Math.max(8, Math.min(idealLeft, maxLeft));
			const arrowLeft = anchorCenter - wrapperRect.left - clampedLeft;
			const top = anchorRect.bottom - wrapperRect.top + 8;
			setCoords({ left: clampedLeft, top, arrowLeft });
		}
		reposition();
		window.addEventListener("resize", reposition);
		window.addEventListener("scroll", reposition, { passive: true });
		return () => {
			window.removeEventListener("resize", reposition);
			window.removeEventListener("scroll", reposition);
		};
	}, [visible, anchorId]);

	// Focus the dismiss on open; on dismiss, return focus to the anchor tab.
	useEffect(() => {
		if (!visible)
			return;
		const t = window.setTimeout(() => dismissRef.current?.focus(), 0);
		return () => window.clearTimeout(t);
	}, [visible]);

	function dismiss(): void {
		try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
		setVisible(false);
		document.getElementById(anchorId)?.focus();
	}

	// ESC and click-outside dismiss.
	useEffect(() => {
		if (!visible)
			return;
		function onKey(event: KeyboardEvent): void {
			if (event.key === "Escape") { event.preventDefault(); dismiss(); }
		}
		function onPointer(event: PointerEvent): void {
			const target = event.target as Node | null;
			if (target === null)
				return;
			if (wrapRef.current?.contains(target) === true)
				return;
			if (document.getElementById(anchorId)?.contains(target) === true)
				return;
			dismiss();
		}
		window.addEventListener("keydown", onKey);
		window.addEventListener("pointerdown", onPointer);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("pointerdown", onPointer);
		};
	}, [visible, anchorId]);

	if (!visible)
		return null;

	return (
		<div
			ref={wrapRef}
			role="dialog"
			aria-modal="false"
			aria-describedby={bodyId}
			aria-label="About Mature cards"
			style={{
				// Translate from the parent's top-left; coords resolve on first
				// paint after layout. Hidden until measured to avoid a flicker.
				visibility: coords === null ? "hidden" : "visible",
				left: coords?.left ?? 0,
				top: coords?.top ?? 0,
			}}
			className="absolute z-[var(--z-popover)] w-[280px] rounded-xs border border-soft-hairline bg-warm-paper-raised p-4 shadow-deck-lift"
		>
			{/* Vermillion arrow pointing up at the Mature tab. */}
			<span
				aria-hidden="true"
				style={{ left: (coords?.arrowLeft ?? 16) - 6 }}
				className="absolute -top-[5px] h-[10px] w-[10px] rotate-45 border-l border-t border-soft-hairline bg-warm-paper-raised"
			/>
			<p id={bodyId} className="text-sm leading-relaxed text-sumi-ink">
				A card matures once Tomo schedules it 21 days out. It's how we measure what you've internalised.
			</p>
			<div className="mt-3 flex justify-end">
				<Button ref={dismissRef} size="sm" variant="secondary" onClick={dismiss}>
					Got it
				</Button>
			</div>
		</div>
	);
}
