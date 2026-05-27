"use client";

import type { CardSortDir, CardSortField } from "@fsrs-japanese/shared-types";

import { DecksMenu, MenuItem } from "@/app/(app)/decks/_components/decks-menu";

import { naturalSortDirFor } from "./cards-filter-state";

interface Props {
	totalCount: number;
	sort: CardSortField;
	/** Explicit user override, or null to mean "use the per-axis natural default." */
	sortDir: CardSortDir | null;
	onPickSort: (next: CardSortField) => void;
	onToggleSortDir: () => void;
	/** Optional micro-status appended after the count (e.g. search query echo). */
	trailingNote?: React.ReactNode | undefined;
}

/**
 * Result-count line for /cards. Composes the live result count with a
 * Sort dropdown and a direction toggle so the three pieces read as one
 * descriptive sentence ("342 cards · Sort by Recently added ↓").
 *
 * Sort axis and direction are deliberately split into two affordances:
 * the dropdown picks the axis (changing axis resets direction to the
 * axis's natural default), the arrow button flips direction in place.
 * This matches the Linear / Notion / GitHub pattern; combined controls
 * (six items in one dropdown) test worse for users who want to flip
 * direction repeatedly.
 */
export function CardsCountLine({
	totalCount,
	sort,
	sortDir,
	onPickSort,
	onToggleSortDir,
	trailingNote,
}: Props): React.JSX.Element {
	const sortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "Recently added";
	const effectiveDir: CardSortDir = sortDir ?? naturalSortDirFor(sort);
	const directionWord = directionAdjectiveFor(sort, effectiveDir);

	return (
		<div className="flex items-center justify-between gap-3">
			{/* Real flex container (not <p> with inline-flow) so every child
          aligns by items-center rather than text baseline. Type scale
          bumps from text-xs → text-sm below `sm:` so the text matches
          the visual weight of 44px touch targets sitting next to it. */}
			<div className="flex min-w-0 items-center gap-2 font-mono text-sm sm:text-xs text-faded-sumi tabular-nums">
				{/* role="status" (implicit polite + atomic) so filtering/searching
            announces the new result count to screen readers. Always in the DOM
            so the live region is registered before it updates. */}
				<span role="status" className="whitespace-nowrap">
					<span className="text-sumi-ink">{totalCount}</span>
					{" "}
					{totalCount === 1 ? "card" : "cards"}
				</span>
				{trailingNote !== undefined && (
					<span className="whitespace-nowrap">{trailingNote}</span>
				)}
				<span aria-hidden="true" className="text-faded-sumi/75">·</span>

				{/* Direction toggle. Placed BEFORE the Sort dropdown so the
            arrow reads as the leading "what ordering" cue. 44px on
            mobile / 20px on desktop. `active:` gives iOS tap feedback. */}
				<button
					type="button"
					onClick={onToggleSortDir}
					aria-label={`Reverse sort direction (currently ${directionWord})`}
					title={directionWord}
					className="ui-motion-colors inline-flex h-11 w-11 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-xs text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink active:bg-cream-inset focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
				>
					<DirGlyph dir={effectiveDir} />
				</button>

				<DecksMenu
					align="start"
					menuClassName="min-w-[12rem]"
					renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
						<button
							ref={triggerRef}
							type="button"
							onClick={onClick}
							onKeyDown={onKeyDown}
							aria-haspopup="menu"
							aria-expanded={ariaExpanded}
							className="ui-motion-colors inline-flex min-h-11 sm:min-h-0 items-center gap-2 rounded-xs px-2 -mx-2 sm:px-1 sm:-mx-1 hover:text-sumi-ink active:bg-cream-inset/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
						>
							<span className="text-faded-sumi">Sort by</span>
							<span className="text-sumi-ink">{sortLabel}</span>
							<Chevron />
						</button>
					)}
					renderItems={({ close }) => (
						<>
							{SORT_OPTIONS.map(opt => (
								<MenuItem
									key={opt.value}
									selected={opt.value === sort}
									onClick={() => { onPickSort(opt.value); close(); }}
								>
									{opt.label}
								</MenuItem>
							))}
						</>
					)}
				/>
			</div>
		</div>
	);
}

// ─── Helpers ────────────────────────────────────────────────────────────

const SORT_OPTIONS: ReadonlyArray<{ value: CardSortField; label: string }> = [
	{ value: "recent", label: "Recently added" },
	{ value: "due", label: "Due date" },
	{ value: "lapses", label: "Most lapses" },
];

/**
 * Human-readable description of the current direction in terms of the
 * specific sort axis. The arrow itself is direction-agnostic; what
 * "↓ on Sort by Due date" actually means ("latest due" or "soonest
 * due") depends on whether we treat ↓ as "descending values" or as
 * "ordering". We render the adjective so screen readers and tooltip
 * users get the unambiguous meaning.
 */
function directionAdjectiveFor(sort: CardSortField, dir: CardSortDir): string {
	if (sort === "recent")
		return dir === "desc" ? "newest first" : "oldest first";
	if (sort === "due")
		return dir === "asc" ? "soonest first" : "latest first";
	// lapses
	return dir === "desc" ? "most first" : "fewest first";
}

function Chevron(): React.JSX.Element {
	// Same scale family as DirGlyph: 11×11 on mobile, 9×9 on desktop.
	// Tracks the surrounding text rather than the touch-target box.
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-[11px] w-[11px] sm:h-[9px] sm:w-[9px] text-faded-sumi"
		>
			<path d="M2 4l3 3 3-3" />
		</svg>
	);
}

function DirGlyph({ dir }: { dir: CardSortDir }): React.JSX.Element {
	// Sized to match the surrounding text scale, NOT the touch-target
	// box. The button is h-11 (44px) on mobile to satisfy WCAG; the
	// empty space around the icon is the buffer, not the visible signal.
	// 13×13 on mobile (closer to text-sm cap height than the previous
	// 18×18 which read oversized due to the SVG stroke weight), 11×11
	// on desktop.
	const sharedClass = "h-[13px] w-[13px] sm:h-[11px] sm:w-[11px]";
	if (dir === "asc") {
		return (
			<svg
				aria-hidden="true"
				viewBox="0 0 10 10"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className={sharedClass}
			>
				<path d="M5 8V2M2.5 4.5L5 2l2.5 2.5" />
			</svg>
		);
	}
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 10 10"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={sharedClass}
		>
			<path d="M5 2v6M2.5 5.5L5 8l2.5-2.5" />
		</svg>
	);
}
