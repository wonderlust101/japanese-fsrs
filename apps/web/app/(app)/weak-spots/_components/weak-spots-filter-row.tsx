"use client";

import type { WeakSpotFilters } from "./weak-spots-types";

import type {
	WeakSpotDiagnosisFilter,
	WeakSpotStatusFilter,
} from "@/lib/actions/weak-spots.actions";
import { useEffect, useRef, useState } from "react";
import { DecksMenu, MenuItem } from "@/app/(app)/decks/_components/decks-menu";
import { IconDecks, IconFlag, IconLightbulb, IconSort } from "@/components/icons/chrome-marks";
import { KbdChip } from "@/components/ui/KbdChip";
import { SearchInput } from "@/components/ui/SearchInput";
import { ToolbarChip } from "@/components/ui/ToolbarChip";

import { useDecks } from "@/lib/api/decks";

interface WeakSpotsFilterRowProps {
	value: WeakSpotFilters;
	onChange: (next: WeakSpotFilters) => void;
	/**
	 * Opt-in page-level reveal participation. When `true`, emits `data-reveal`
	 * on the toolbar's `<section>` so the weak-spots `useRevealMount` cascade
	 * fades the filter chrome in behind the header lead (NOT the list rows).
	 * Default `false`.
	 */
	reveal?: boolean;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: WeakSpotStatusFilter; label: string }> = [
	{ value: "unresolved", label: "Unresolved" },
	{ value: "resolved", label: "Resolved" },
];

const JLPT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "all", label: "Any JLPT" },
	{ value: "N5", label: "N5" },
	{ value: "N4", label: "N4" },
	{ value: "N3", label: "N3" },
	{ value: "N2", label: "N2" },
	{ value: "N1", label: "N1" },
	{ value: "beyond_jlpt", label: "Beyond JLPT" },
];

const DIAGNOSIS_OPTIONS: ReadonlyArray<{ value: WeakSpotDiagnosisFilter | "all"; label: string }> = [
	{ value: "all", label: "Any diagnosis" },
	{ value: "available", label: "Diagnosed" },
	{ value: "missing", label: "Undiagnosed" },
];

/**
 * Toolbar for the weakSpots page, a faithful port of the Cards-browser
 * toolbar so the two surfaces read as one family. Same `flex flex-col gap-3
 * border-b pb-4` section with two rows:
 *
 *   Row 1 — a full-width debounced search field (the shared `SearchInput`
 *           primitive + Cmd-K focus, identical to `/cards`). Cards also seats
 *           its saved-View dropdown here; weakSpots has no saved-views concept,
 *           so the search takes the whole row.
 *   Row 2 — the filter dimensions (Status, Deck, JLPT, Diagnosis) as
 *           `ToolbarChip` dropdowns, each with a leading icon. Sort is absent
 *           by design: it lives on the result-count line below, next to the
 *           count it orders, exactly as on `/cards`.
 *
 * Each chip flips to the `selected` (vermillion-wash) state whenever its
 * dimension narrows the list, the same active-filter cue the Cards toolbar
 * uses.
 */
export function WeakSpotsFilterRow({
	value,
	onChange,
	reveal = false,
}: WeakSpotsFilterRowProps): React.JSX.Element {
	const decksQuery = useDecks(50);
	const decks = decksQuery.data?.items ?? [];

	const deckLabel = value.deckId === "all"
		? "All decks"
		: (decks.find(d => d.id === value.deckId)?.name ?? "Unknown deck");

	const jlptLabel = (() => {
		if (value.jlptLevel === "all")
			return "Any JLPT";
		const opt = JLPT_OPTIONS.find(o => o.value === value.jlptLevel);
		if (opt === undefined)
			return value.jlptLevel;
		return value.jlptLevel === "beyond_jlpt" ? opt.label : `JLPT ${opt.label}`;
	})();

	const statusLabel = STATUS_OPTIONS.find(o => o.value === value.status)?.label ?? "Unresolved";
	const diagnosisLabel = DIAGNOSIS_OPTIONS.find(o => o.value === value.diagnosis)?.label ?? "Any diagnosis";

	const iconClass = "h-3.5 w-3.5 text-faded-sumi";

	return (
		<section
			aria-label="Weak spot filters"
			className="flex flex-col gap-3 border-b border-soft-hairline pb-4"
			{...(reveal && { "data-reveal": "" })}
		>
			{/* Row 1: search */}
			<div className="flex min-w-0 items-center gap-2">
				<div className="min-w-0 flex-1">
					<WeakSpotsSearchBar
						value={value.search}
						onChange={search => onChange({ ...value, search })}
					/>
				</div>
			</div>

			{/* Row 2: filter dimensions */}
			<div className="flex flex-wrap items-center gap-2">
				{/* Status — the binary that flips the whole list's meaning. Treated as
            a dimension dropdown (not a tablist) so it reads like the Cards
            Status chip; `selected` whenever the non-default Resolved view is
            active. */}
				<ChromeDropdown
					label={statusLabel}
					icon={<IconFlag className={iconClass} />}
					selected={value.status === "resolved"}
					options={STATUS_OPTIONS}
					activeValue={value.status}
					onPick={status => onChange({ ...value, status })}
					menuWidth="min-w-[10rem]"
				/>

				<ChromeDropdown
					label={deckLabel}
					icon={<IconDecks className={iconClass} />}
					selected={value.deckId !== "all"}
					options={[
						{ value: "all", label: "All decks" },
						...decks.map(d => ({ value: d.id, label: d.name })),
					]}
					activeValue={value.deckId}
					onPick={deckId => onChange({ ...value, deckId })}
					triggerClassName="max-w-[12rem]"
					menuWidth="min-w-[14rem]"
				/>

				<ChromeDropdown
					label={jlptLabel}
					icon={<IconSort className={iconClass} />}
					selected={value.jlptLevel !== "all"}
					options={JLPT_OPTIONS}
					activeValue={value.jlptLevel}
					onPick={jlptLevel => onChange({ ...value, jlptLevel })}
				/>

				<ChromeDropdown
					label={diagnosisLabel}
					icon={<IconLightbulb className={iconClass} />}
					selected={value.diagnosis !== "all"}
					options={DIAGNOSIS_OPTIONS}
					activeValue={value.diagnosis}
					onPick={diagnosis =>
						onChange({
							...value,
							diagnosis: diagnosis === "available" || diagnosis === "missing" ? diagnosis : "all",
						})}
				/>
			</div>
		</section>
	);
}

// ─── Search bar ────────────────────────────────────────────────────────────────

/**
 * Debounced search field, the weakSpots twin of `CardsSearchBar`: same shared
 * `SearchInput` primitive and Cmd-K focus, with weakSpot-appropriate labels.
 * The visible value is local; it pushes to the parent 250ms after the user
 * stops typing so the list doesn't refetch on every keystroke.
 */
function WeakSpotsSearchBar({
	value,
	onChange,
}: {
	value: string;
	onChange: (next: string) => void;
}): React.JSX.Element {
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<HTMLInputElement | null>(null);

	// Resync when the parent clears the search externally (e.g. a return visit
	// resets it, or a future "clear all" affordance).
	useEffect(() => { setDraft(value); }, [value]); // eslint-disable-line react/set-state-in-effect -- resyncs the local draft when the parent clears/changes the search value

	useEffect(() => {
		const id = window.setTimeout(() => {
			if (draft !== value)
				onChange(draft);
		}, 250);
		return () => window.clearTimeout(id);
	}, [draft, value, onChange]);

	useEffect(() => {
		function onKey(event: KeyboardEvent): void {
			const meta = event.metaKey || event.ctrlKey;
			if (meta && event.key.toLowerCase() === "k") {
				const active = document.activeElement;
				if (active instanceof HTMLInputElement && active !== inputRef.current)
					return;
				event.preventDefault();
				inputRef.current?.focus();
				inputRef.current?.select();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<SearchInput
			ref={inputRef}
			value={draft}
			onChange={setDraft}
			placeholder="Search by word, reading, meaning…"
			ariaLabel="Search weak spots"
			trailing={(
				<KbdChip
					placement="floating"
					className="hidden sm:inline-flex"
					ariaLabel="Press Cmd K to focus search"
				>
					⌘K
				</KbdChip>
			)}
		/>
	);
}

// ─── ChromeDropdown ────────────────────────────────────────────────────────────

interface ChromeDropdownProps<T extends string> {
	label: string;
	icon?: React.ReactNode;
	selected: boolean;
	options: ReadonlyArray<{ value: T; label: string }>;
	activeValue: T;
	onPick: (value: T) => void;
	triggerClassName?: string;
	menuWidth?: string;
}

/**
 * A `DecksMenu`-backed dropdown whose trigger is a `ToolbarChip`. This is the
 * same composition the Cards toolbar uses for its dimension pickers; kept as
 * a thin local copy (rather than imported from the cards module) because the
 * cards version is typed against card-specific filter enums, and coupling the
 * two surfaces' filter types would be the wrong shared boundary.
 */
function ChromeDropdown<T extends string>({
	label,
	icon,
	selected,
	options,
	activeValue,
	onPick,
	triggerClassName,
	menuWidth = "min-w-[12rem]",
}: ChromeDropdownProps<T>): React.JSX.Element {
	return (
		<DecksMenu
			align="start"
			menuClassName={menuWidth}
			renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
				<ToolbarChip
					ref={triggerRef}
					onClick={onClick}
					onKeyDown={onKeyDown}
					aria-haspopup="menu"
					aria-expanded={ariaExpanded}
					state={selected ? "selected" : "default"}
					{...(icon !== undefined ? { leadingNode: icon } : {})}
					trailingNode={<Chevron />}
					// 44px touch target on coarse pointers (the chip's default md height
					// is 36px); collapses to the intrinsic height from sm: up.
					className={["min-h-11 sm:min-h-0", triggerClassName ?? ""].join(" ").trim()}
				>
					<span className="truncate">{label}</span>
				</ToolbarChip>
			)}
			renderItems={({ close }) => (
				<>
					{options.map(opt => (
						<MenuItem
							key={opt.value}
							selected={opt.value === activeValue}
							onClick={() => { onPick(opt.value); close(); }}
						>
							{opt.label}
						</MenuItem>
					))}
				</>
			)}
		/>
	);
}

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
