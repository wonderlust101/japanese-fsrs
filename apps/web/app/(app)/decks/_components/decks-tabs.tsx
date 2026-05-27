"use client";

import type { DecksViewTab } from "./use-deck-prefs";

import { useRef } from "react";

/**
 * Top-level tabs for the Decks page. Three views:
 *
 *   - Active   — every non-archived deck (default).
 *   - Mature   — non-archived decks whose cards are 100% mature
 *                (matureCount === cardCount, cardCount > 0). Shows what
 *                you've fully internalised.
 *   - Archived — decks the user has set aside.
 *
 * Implements the full ARIA tab pattern: each tab carries `role=tab`,
 * `aria-controls` pointing at the deck-list panel, and arrow-key /
 * Home / End navigation between tabs. The matching `role=tabpanel` and
 * `aria-labelledby` live in `deck-list.tsx`.
 */

export interface TabCounts {
	active: number;
	mature: number;
	archived: number;
}

const TAB_ORDER: ReadonlyArray<DecksViewTab> = ["active", "mature", "archived"];
const TAB_LABEL: Record<DecksViewTab, string> = {
	active: "Active",
	mature: "Mature",
	archived: "Archived",
};

export function DecksTabs({
	view,
	counts,
	panelId,
	onChange,
}: {
	view: DecksViewTab;
	counts: TabCounts;
	panelId: string;
	onChange: (next: DecksViewTab) => void;
}): React.JSX.Element {
	const refs = useRef<Map<DecksViewTab, HTMLButtonElement | null>>(new Map());

	function focusTab(next: DecksViewTab): void {
		onChange(next);
		// Move focus to the now-selected tab so SRs announce the change and
		// keyboard users stay anchored in the tablist.
		requestAnimationFrame(() => {
			refs.current.get(next)?.focus();
		});
	}

	function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
		const idx = TAB_ORDER.indexOf(view);
		if (idx === -1)
			return;
		let next: DecksViewTab | null = null;
		switch (event.key) {
			case "ArrowRight":
			case "ArrowDown":
				next = TAB_ORDER[(idx + 1) % TAB_ORDER.length] ?? null;
				break;
			case "ArrowLeft":
			case "ArrowUp":
				next = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length] ?? null;
				break;
			case "Home":
				next = TAB_ORDER[0] ?? null;
				break;
			case "End":
				next = TAB_ORDER[TAB_ORDER.length - 1] ?? null;
				break;
		}
		if (next !== null) {
			event.preventDefault();
			focusTab(next);
		}
	}

	return (
		<div
			role="tablist"
			aria-label="Deck view"
			className="flex items-center gap-1 border-b border-soft-hairline"
		>
			{TAB_ORDER.map(key => (
				<TabButton
					key={key}
					tabKey={key}
					label={TAB_LABEL[key]}
					count={counts[key]}
					active={view === key}
					panelId={panelId}
					onClick={() => onChange(key)}
					onKeyDown={onKeyDown}
					registerRef={el => refs.current.set(key, el)}
				/>
			))}
		</div>
	);
}

function TabButton({
	tabKey,
	label,
	count,
	active,
	panelId,
	onClick,
	onKeyDown,
	registerRef,
}: {
	tabKey: DecksViewTab;
	label: string;
	count: number;
	active: boolean;
	panelId: string;
	onClick: () => void;
	onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
	registerRef: (el: HTMLButtonElement | null) => void;
}): React.JSX.Element {
	return (
		<button
			ref={registerRef}
			id={`decks-tab-${tabKey}`}
			type="button"
			role="tab"
			aria-selected={active}
			aria-controls={panelId}
			// Roving tabindex: only the selected tab is tabbable, arrow keys move
			// between the others. Standard ARIA tab pattern.
			tabIndex={active ? 0 : -1}
			onClick={onClick}
			onKeyDown={onKeyDown}
			className={[
				// 44px touch target on mobile, release on desktop. Matches the
				// toolbar chip sizing pattern used in DecksUtilityRow.
				"ui-motion-colors relative inline-flex min-h-11 items-center gap-2 px-3 py-2.5 text-sm sm:min-h-0",
				"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
				active
					? "text-sumi-ink font-medium"
					: "text-faded-sumi hover:text-sumi-ink",
			].join(" ")}
		>
			<span>{label}</span>
			<span
				className={[
					"font-mono text-xs tabular-nums",
					active ? "text-sumi-ink" : "text-faded-sumi",
				].join(" ")}
			>
				{count}
			</span>
			{active && (
				<span
					aria-hidden="true"
					className="absolute inset-x-0 -bottom-px h-0.5 bg-inari-vermillion"
				/>
			)}
		</button>
	);
}
