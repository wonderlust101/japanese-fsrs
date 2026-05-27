"use client";

import type { FuriganaMode } from "@/stores/useSessionPreferencesStore";
import { useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";
import { MenuItem } from "@/components/ui/MenuItem";

interface OverflowMenuProps {
	/**
	 * ID of the card currently under review. Used to build the new-tab
	 *  "View scheduling info" link to the card detail page.
	 */
	cardId: string;
	deckName: string | null;
	audioMuted: boolean;
	onToggleAudio: () => void;
	furiganaMode: FuriganaMode;
	onCycleFurigana: () => void;
	/**
	 * Whether the sentence translation auto-reveals (true) or sits behind a
	 *  blur until tapped (false). Default state is false.
	 */
	autoRevealTranslation: boolean;
	onToggleAutoRevealTranslation: () => void;
	trigger: React.ReactNode;
	/**
	 * Open the suspend-card confirm dialog. The menu closes synchronously so
	 *  the dialog's focus-trap can claim the surface cleanly.
	 */
	onSuspendCard?: () => void;
}

// Tiny external-link indicator: arrow rising up-right out of a corner. Used
// as the trailing glyph on menu items that open a new tab so the user knows
// the click leaves the current surface before they take it. Drawn in the
// chrome-marks construction grammar: lighter frame (0.85 stroke), heavier
// arrow shaft (1.25 stroke), small focal dot at the arrow's exit corner.
function ExternalLinkIndicator(): React.JSX.Element {
	return (
		<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
			{/* Frame: lighter L-shape opening up + right */}
			<path
				d="M4.5 2.5 H 9.5 V 7.5"
				stroke="currentColor"
				strokeWidth="0.85"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity="0.85"
			/>
			{/* Arrow shaft: heavier, exits through the open corner */}
			<path
				d="M 9.5 2.5 L 3 9"
				stroke="currentColor"
				strokeWidth="1.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{/* Focal dot at the arrow's exit corner — chrome-marks brand device */}
			<circle cx="9.5" cy="2.5" r="0.75" fill="currentColor" />
		</svg>
	);
}

interface MenuPosition {
	top: number;
	right: number;
}

// Card-scoped overflow menu. Single source of truth for learner prefs (Mute
// audio, Sentence furigana) and per-card actions. The menu surface portals
// to <body> so it can drop *outside* the SectionCard's overflow-hidden
// clipping context (the clipping exists to keep the brand top-stripe inside
// the card's rounded corners). Positioning is captured once on open via
// the trigger's bounding rect; the menu closes on scroll/resize because
// re-anchoring during every scroll tick is more code than the UX is worth.

export function OverflowMenu({
	cardId,
	deckName,
	audioMuted,
	onToggleAudio,
	furiganaMode,
	onCycleFurigana,
	autoRevealTranslation,
	onToggleAutoRevealTranslation,
	trigger,
	onSuspendCard,
}: OverflowMenuProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState<MenuPosition | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);

	// Compute right-aligned drop position from the trigger's viewport rect.
	// 8px gap below the trigger matches the previous `mt-2` value.
	function captureTriggerRect(): void {
		const t = triggerRef.current;
		if (t === null)
			return;
		const r = t.getBoundingClientRect();
		setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
	}

	useEffect(() => {
		if (!open)
			return;
		function onMouseDown(e: MouseEvent) {
			const target = e.target as Node;
			const insideTrigger = triggerRef.current?.contains(target) === true;
			const insideMenu = menuRef.current?.contains(target) === true;
			if (!insideTrigger && !insideMenu)
				setOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
				return;
			}
			// ARIA menu pattern: ↑/↓ cycle focus between menuitems; Home/End jump.
			// We scope the lookup to enabled menuitems so the disabled stubs
			// (Edit card, Report an issue) are skipped in keyboard nav.
			const isNav = ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key);
			if (!isNav)
				return;
			const menu = menuRef.current;
			if (menu === null)
				return;
			const items = Array.from(
				menu.querySelectorAll<HTMLElement>("[role=\"menuitem\"]:not([disabled])"),
			);
			if (items.length === 0)
				return;
			e.preventDefault();
			const active = document.activeElement as HTMLElement | null;
			const currentIndex = active === null ? -1 : items.indexOf(active);
			let nextIndex = currentIndex;
			if (e.key === "ArrowDown")
				nextIndex = (currentIndex + 1 + items.length) % items.length;
			if (e.key === "ArrowUp")
				nextIndex = (currentIndex - 1 + items.length) % items.length;
			if (e.key === "Home")
				nextIndex = 0;
			if (e.key === "End")
				nextIndex = items.length - 1;
			// Cold-open arrow press lands on the first item rather than wrapping
			// backwards from -1 to last.
			if (currentIndex === -1 && (e.key === "ArrowDown" || e.key === "ArrowUp"))
				nextIndex = 0;
			items[nextIndex]?.focus();
		}
		function onScrollOrResize() {
			setOpen(false);
		}
		document.addEventListener("mousedown", onMouseDown);
		document.addEventListener("keydown", onKey);
		window.addEventListener("scroll", onScrollOrResize, true); // capture: also catches inner scroll containers
		window.addEventListener("resize", onScrollOrResize);
		return () => {
			document.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", onScrollOrResize, true);
			window.removeEventListener("resize", onScrollOrResize);
		};
	}, [open]);

	// Move focus into the first enabled menu item on open, matching DecksMenu /
	// UserMenu so keyboard users land inside the menu without an extra ArrowDown.
	useEffect(() => {
		if (!open)
			return;
		const id = window.setTimeout(() => {
			menuRef.current?.querySelector<HTMLElement>("[role=\"menuitem\"]:not([disabled])")?.focus();
		}, 0);
		return () => window.clearTimeout(id);
	}, [open]);

	const portalNode
		= typeof document !== "undefined" && open && pos !== null
			? createPortal(
					<div
						ref={menuRef}
						role="menu"
						style={{ top: pos.top, right: pos.right }}
						className="fixed z-[var(--z-popover)] w-64 rounded-xs border border-soft-hairline bg-warm-paper-raised shadow-card py-2"
					>
						{deckName !== null && (
							<div className="px-3 pb-2 pt-1 border-b border-soft-hairline/60">
								<p className="font-mono text-sm text-faded-sumi">Deck</p>
								<p className="text-sm text-sumi-ink truncate">{deckName}</p>
							</div>
						)}

						<MenuItem.SectionLabel>Preferences</MenuItem.SectionLabel>
						<MenuItem
							onClick={onToggleAudio}
							trailing={audioMuted ? "Muted" : "On"}
						>
							Mute audio
						</MenuItem>
						<MenuItem
							onClick={onCycleFurigana}
							trailing={furiganaMode === "hover" ? "Hover" : furiganaMode === "always" ? "Always" : "Off"}
						>
							Sentence furigana
						</MenuItem>
						<MenuItem
							onClick={onToggleAutoRevealTranslation}
							trailing={autoRevealTranslation ? "On" : "Off"}
						>
							Auto-reveal translation
						</MenuItem>

						<MenuItem.Separator />

						<MenuItem.SectionLabel>This card</MenuItem.SectionLabel>
						<MenuItem disabled>Edit card</MenuItem>
						{onSuspendCard !== undefined
							? (
									<MenuItem onClick={() => { setOpen(false); onSuspendCard(); }}>
										Suspend card
									</MenuItem>
								)
							: (
									<MenuItem disabled>Suspend card</MenuItem>
								)}
						<MenuItem disabled>Report an issue</MenuItem>
						<MenuItem.Link
							href={`/cards/${cardId}`}
							target="_blank"
							rel="noopener noreferrer"
							onClick={() => setOpen(false)}
							trailing={<ExternalLinkIndicator />}
						>
							View scheduling info
						</MenuItem.Link>
					</div>,
					document.body,
				)
			: null;

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => {
					if (!open)
						captureTriggerRect();
					setOpen(o => !o);
				}}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="Card menu"
				className="block cursor-pointer"
			>
				{trigger}
			</button>
			{portalNode}
		</>
	);
}
