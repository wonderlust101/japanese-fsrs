"use client";

import type { DecksSortKey, DecksTypeFilter } from "./use-deck-prefs";

import { useEffect, useRef } from "react";
import {
	IconEdit,
	IconFilter,
	IconSort,
} from "@/components/icons/chrome-marks";
import { KbdChip } from "@/components/ui/KbdChip";
import { SearchInput } from "@/components/ui/SearchInput";

import { ToolbarChip } from "@/components/ui/ToolbarChip";
import { DecksMenu, MenuItem } from "./decks-menu";

const SORT_LABEL: Record<DecksSortKey, string> = {
	"study-order": "Study order",
	"recently-reviewed": "Recently reviewed",
	"alphabetical": "Alphabetical",
	"most-due-first": "Most due first",
	"jlpt-level": "JLPT level",
};

const SORT_ORDER: ReadonlyArray<DecksSortKey> = [
	"study-order",
	"recently-reviewed",
	"alphabetical",
	"most-due-first",
	"jlpt-level",
];

const TYPE_LABEL: Record<DecksTypeFilter, string> = {
	all: "All types",
	vocabulary: "Vocabulary",
	kanji: "Kanji",
	mixed: "Mixed",
};

const TYPE_ORDER: ReadonlyArray<DecksTypeFilter> = ["all", "vocabulary", "kanji", "mixed"];

interface DecksUtilityRowProps {
	sort: DecksSortKey;
	typeFilter: DecksTypeFilter;
	searchQuery: string;
	curateActive: boolean;
	onSort: (sort: DecksSortKey) => void;
	onTypeFilter: (filter: DecksTypeFilter) => void;
	onSearchQuery: (query: string) => void;
	onCurate: () => void;
}

export function DecksUtilityRow({
	sort,
	typeFilter,
	searchQuery,
	curateActive,
	onSort,
	onTypeFilter,
	onSearchQuery,
	onCurate,
}: DecksUtilityRowProps): React.JSX.Element {
	const searchRef = useRef<HTMLInputElement | null>(null);

	// ⌘K (or Ctrl+K outside macOS) focuses the search input.
	useEffect(() => {
		function onKey(event: KeyboardEvent): void {
			const meta = event.metaKey || event.ctrlKey;
			if (meta && event.key.toLowerCase() === "k") {
				// Don't hijack the browser's URL bar shortcut on Firefox where it
				// overlaps; if focus is in an input that isn't ours, let it through.
				const active = document.activeElement;
				if (active instanceof HTMLInputElement && active !== searchRef.current)
					return;
				event.preventDefault();
				searchRef.current?.focus();
				searchRef.current?.select();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<section
			aria-label="Deck list controls"
			className="flex flex-col gap-3 border-t border-soft-hairline pt-4 pb-4 sm:flex-row sm:items-center sm:gap-3 sm:py-4"
		>
			{/* Left cluster: sort / type. Archived tab handles archive view. */}
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<SortDropdown current={sort} onChange={onSort} />
				<TypeDropdown current={typeFilter} onChange={onTypeFilter} />
			</div>

			{/* Right cluster: search + curate. min-w-0 prevents the search from
          pushing the row off-screen on narrow desktop windows. */}
			<div className="flex flex-1 items-center justify-end gap-2 sm:min-w-[18rem]">
				<div className="relative flex-1 sm:max-w-[20rem]">
					<SearchInput
						ref={searchRef}
						value={searchQuery}
						onChange={onSearchQuery}
						placeholder="Find a deck"
						ariaLabel="Find a deck"
						trailing={(
							<KbdChip size="xs" placement="floating" className="hidden sm:inline-flex">
								⌘K
							</KbdChip>
						)}
					/>
				</div>
				<CurateButton active={curateActive} onClick={onCurate} />
			</div>
		</section>
	);
}

// ── Sort ─────────────────────────────────────────────────────────────────

function SortDropdown({
	current,
	onChange,
}: {
	current: DecksSortKey;
	onChange: (sort: DecksSortKey) => void;
}): React.JSX.Element {
	return (
		<DecksMenu
			align="start"
			menuClassName="min-w-[12rem]"
			renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
				<ToolbarChip
					ref={triggerRef}
					onClick={onClick}
					onKeyDown={onKeyDown}
					aria-haspopup="menu"
					aria-expanded={ariaExpanded}
					leadingNode={<IconSort className="h-3.5 w-3.5 text-faded-sumi" />}
					trailingNode={<Chevron />}
					// Sibling-consistency with the cards page: 44px touch target
					// on mobile, release on desktop. Same `min-h-11 sm:min-h-0`
					// pattern used across the cards toolbar primitives.
					className="min-h-11 sm:min-h-0 active:bg-cream-inset"
				>
					<span className="hidden text-faded-sumi sm:inline">Sort </span>
					<span className="text-sumi-ink">{SORT_LABEL[current]}</span>
				</ToolbarChip>
			)}
			renderItems={({ close }) => (
				<>
					{SORT_ORDER.map(key => (
						<MenuItem
							key={key}
							selected={key === current}
							onClick={() => { onChange(key); close(); }}
						>
							{SORT_LABEL[key]}
						</MenuItem>
					))}
				</>
			)}
		/>
	);
}

// ── Type filter ──────────────────────────────────────────────────────────

function TypeDropdown({
	current,
	onChange,
}: {
	current: DecksTypeFilter;
	onChange: (filter: DecksTypeFilter) => void;
}): React.JSX.Element {
	return (
		<DecksMenu
			align="start"
			menuClassName="min-w-[10rem]"
			renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
				<ToolbarChip
					ref={triggerRef}
					onClick={onClick}
					onKeyDown={onKeyDown}
					aria-haspopup="menu"
					aria-expanded={ariaExpanded}
					leadingNode={<IconFilter className="h-3.5 w-3.5 text-faded-sumi" />}
					trailingNode={<Chevron />}
					className="min-h-11 sm:min-h-0 active:bg-cream-inset"
				>
					{TYPE_LABEL[current]}
				</ToolbarChip>
			)}
			renderItems={({ close }) => (
				<>
					{TYPE_ORDER.map(key => (
						<MenuItem
							key={key}
							selected={key === current}
							onClick={() => { onChange(key); close(); }}
						>
							{TYPE_LABEL[key]}
						</MenuItem>
					))}
				</>
			)}
		/>
	);
}

// ── Curate ───────────────────────────────────────────────────────────────

function CurateButton({
	active,
	onClick,
}: {
	active: boolean;
	onClick: () => void;
}): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			aria-label={active ? "Done curating" : "Curate decks"}
			className={[
				// h-9 desktop / min-h-11 mobile = same touch-sizing pattern
				// as cards toolbar primitives. active: gives iOS tap feedback.
				// shrink-0 keeps the button at its natural width so it never compresses
				// the flex-1 search field sharing its row. On mobile it goes icon-only
				// and holds a full 44x44 touch target (min-w + min-h + centered icon);
				// at sm it relaxes to the inline h-9 label button. label returns at sm.
				"ui-motion-colors inline-flex h-9 min-h-11 min-w-[44px] sm:min-h-0 sm:min-w-0 shrink-0 items-center justify-center sm:justify-start gap-2 rounded-xs px-2.5 sm:pr-3 text-sm font-medium",
				"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
				active
					? "bg-sumi-ink text-warm-paper-raised hover:bg-sumi-ink/95 active:bg-sumi-ink/85"
					: "border border-soft-hairline bg-warm-paper-raised text-sumi-ink hover:border-faded-sumi hover:bg-cream-inset active:bg-cream-inset",
			].join(" ")}
		>
			<IconEdit className="h-3.5 w-3.5" />
			<span className="hidden sm:inline">{active ? "Done" : "Curate"}</span>
		</button>
	);
}

// ── Shared chrome ────────────────────────────────────────────────────────

function Chevron(): React.JSX.Element {
	return (
		<svg
			aria-hidden="true"
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="text-faded-sumi"
		>
			<path d="M2 4l3 3 3-3" />
		</svg>
	);
}
