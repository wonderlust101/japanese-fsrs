"use client";

import type { DeckRow } from "./setup-deck-list";

import type { TabItem } from "@/components/ui/Tabs";
import type {
	NewCardOrder,
	ReviewOrder,
	SessionTuning,
} from "@/stores/useSessionTuningStore";
import { useId, useState } from "react";
import { ArrowGlyph } from "@/components/icons/arrow-glyph";
import { Checkbox } from "@/components/ui/Checkbox";
import { DefRow } from "@/components/ui/DefList";
import { SectionCard } from "@/components/ui/SectionCard";
import { TabPanel, Tabs } from "@/components/ui/Tabs";

import { Segmented } from "@/components/ui/Toggle";

import { cn } from "@/lib/utils";
import { DEFAULT_TUNING } from "@/stores/useSessionTuningStore";
import { SetupDeckList } from "./setup-deck-list";

interface SetupControlsProps {
	tuning: SessionTuning;
	onChange: <K extends keyof SessionTuning>(key: K, value: SessionTuning[K]) => void;
	decks: ReadonlyArray<DeckRow>;
	totalDue: number;
	disabled?: boolean;
}

const SIZE_OPTIONS: ReadonlyArray<number> = [10, 20, 30, 50, 0];
const REVIEW_ORDER_OPTIONS: ReadonlyArray<{ value: ReviewOrder; label: string }> = [
	{ value: "urgency", label: "Urgency" },
	{ value: "shuffle", label: "Shuffle" },
	{ value: "difficulty", label: "Difficulty" },
];
const NEW_ORDER_OPTIONS: ReadonlyArray<{ value: NewCardOrder; label: string }> = [
	{ value: "deck-order", label: "Deck order" },
	{ value: "shuffle", label: "Shuffle" },
	{ value: "frequency", label: "Frequency" },
];

// Deck list is paginated to 5 rows per page. The pagination chrome below the
// list is hidden when the total deck count fits on one page.
const DECKS_PER_PAGE = 5;

// Per-child constraint so every row in the panel fills the container width.
const ROW_COLUMN = "[&>*]:w-full";

export function SetupControls({
	tuning,
	onChange,
	decks,
	totalDue,
	disabled,
}: SetupControlsProps): React.JSX.Element {
	const allIncluded = tuning.includedDeckIds === null;
	const noneIncluded = tuning.includedDeckIds !== null && tuning.includedDeckIds.length === 0;
	const includedCount = allIncluded ? decks.length : (tuning.includedDeckIds?.length ?? 0);

	// Pagination state for the deck list. Resets to page 0 when the deck count
	// shrinks below the current page's range.
	const [page, setPage] = useState(0);
	const pageCount = Math.max(1, Math.ceil(decks.length / DECKS_PER_PAGE));
	const safePage = Math.min(page, pageCount - 1);
	const visibleDecks = decks.slice(safePage * DECKS_PER_PAGE, (safePage + 1) * DECKS_PER_PAGE);
	const showPagination = decks.length > DECKS_PER_PAGE;

	// Tab state. Defaults to decks since that's the primary scoping decision.
	const [tab, setTab] = useState<"decks" | "session">("decks");
	const tabsId = useId();

	// Tab badges glance-report state vs. defaults:
	//   • Decks: how many decks are included when the user has narrowed away from "all".
	//   • Session: count of tunings overridden from DEFAULT_TUNING. newCardOrder
	//     only counts when new cards are actually being included.
	const decksBadge = allIncluded ? 0 : includedCount;
	const sessionModifiedCount
		= (tuning.sessionSize !== DEFAULT_TUNING.sessionSize ? 1 : 0)
			+ (tuning.includeNewCards !== DEFAULT_TUNING.includeNewCards ? 1 : 0)
			+ (tuning.includeNewCards && tuning.newCardOrder !== DEFAULT_TUNING.newCardOrder ? 1 : 0)
			+ (tuning.reviewOrder !== DEFAULT_TUNING.reviewOrder ? 1 : 0)
			+ (tuning.overdueFirst !== DEFAULT_TUNING.overdueFirst ? 1 : 0);

	// Show "3/12" instead of bare "3" so the included-count and the
	// total-deck-count are legible at the tab level. Visible only when the
	// user has narrowed away from "all"; full inclusion suppresses the
	// badge via badge===0.
	const decksBadgeText = decksBadge > 0 ? `${decksBadge}/${decks.length}` : undefined;
	const tabs: ReadonlyArray<TabItem<"decks" | "session">> = [
		{
			value: "decks",
			label: "Decks",
			badge: decksBadge,
			badgeLabel: `of ${decks.length} included`,
			...(decksBadgeText !== undefined && { badgeText: decksBadgeText }),
		},
		{
			value: "session",
			label: "Session",
			badge: sessionModifiedCount,
			badgeLabel: "modified",
		},
	];

	return (
		<SectionCard
			kanji="調"
			label="Choose settings"
			description="Anything you change here lasts for this session only, unless you save it as your default."
			stripeTone="aizome"
			kanjiTone="aizome"
			reveal
			// Scoped accent swap. Any descendant painted in the vermillion
			// accent is retinted to aizome for this surface only. The descendant
			// variants compile with specificity (0,2,0) which naturally beats
			// the (0,1,0) original utility — no !important needed. Flipping
			// back is one className deletion.
			className="
        [&_.bg-inari-vermillion]:bg-aizome-indigo
        [&_.bg-vermillion-wash]:bg-aizome-wash
        [&_.text-inari-vermillion]:text-aizome-indigo
        [&_.text-inari-vermillion-deep]:text-aizome-indigo-deep
        [&_.border-inari-vermillion]:border-aizome-indigo
        [&_.border-inari-vermillion\/80]:border-aizome-indigo/80
      "
		>
			<fieldset
				disabled={disabled}
				className={cn("min-w-0", disabled === true && "opacity-60 pointer-events-none")}
			>
				<legend className="sr-only">Session tuning controls</legend>

				<Tabs
					items={tabs}
					value={tab}
					onChange={setTab}
					ariaLabel="Session setup sections"
					idBase={tabsId}
				/>

				{tab === "decks" && (
					<TabPanel idBase={tabsId} value="decks">
						<DecksSection
							tuning={tuning}
							onChange={onChange}
							decks={decks}
							visibleDecks={visibleDecks}
							totalDue={totalDue}
							allIncluded={allIncluded}
							noneIncluded={noneIncluded}
							includedCount={includedCount}
							showPagination={showPagination}
							page={safePage}
							pageCount={pageCount}
							onPageChange={setPage}
						/>
					</TabPanel>
				)}

				{tab === "session" && (
					<TabPanel idBase={tabsId} value="session">
						<div className={cn(ROW_COLUMN, "flex flex-col")}>
							<DefRow
								label="Session size"
								description="Stop after this many cards. Anything you don't see today returns tomorrow."
								modified={tuning.sessionSize !== DEFAULT_TUNING.sessionSize}
								control={(
									<Segmented
										ariaLabel="Session size"
										value={String(tuning.sessionSize)}
										options={SIZE_OPTIONS.map(n => ({
											value: String(n),
											label: n === 0 ? "All" : String(n),
										}))}
										onChange={v => onChange("sessionSize", Number(v))}
									/>
								)}
							/>
							<Checkbox.Row
								checked={tuning.includeNewCards}
								onChange={next => onChange("includeNewCards", next)}
								label="Include new cards today"
								description={
									tuning.includeNewCards
										? "Fresh cards are added on top of your due reviews."
										: "Only due reviews. New cards are deferred."
								}
							/>
							{tuning.includeNewCards && (
								<DefRow
									label="New-card order"
									description="Show new cards in deck order, shuffled, or sorted by word frequency."
									modified={tuning.newCardOrder !== DEFAULT_TUNING.newCardOrder}
									control={(
										<Segmented
											ariaLabel="New-card order"
											value={tuning.newCardOrder}
											options={NEW_ORDER_OPTIONS}
											onChange={v => onChange("newCardOrder", v)}
										/>
									)}
								/>
							)}
							<DefRow
								label="Review order"
								description="Tackle reviews by urgency, in random order, or hardest first."
								modified={tuning.reviewOrder !== DEFAULT_TUNING.reviewOrder}
								control={(
									<Segmented
										ariaLabel="Review order"
										value={tuning.reviewOrder}
										options={REVIEW_ORDER_OPTIONS}
										onChange={v => onChange("reviewOrder", v)}
									/>
								)}
							/>
							<Checkbox.Row
								checked={tuning.overdueFirst}
								onChange={next => onChange("overdueFirst", next)}
								label="Overdue first"
								description="Focus only on overdue cards. Reviews due today and new cards are deferred."
							/>
						</div>

						<WhyTheseDefaults />
					</TabPanel>
				)}
			</fieldset>
		</SectionCard>
	);
}

// ── Decks section ───────────────────────────────────────────────────────────
// Lives at the top of the panel as a row-equivalent. Carries its own meta row
// (count + All/None bulk actions), the paginated deck list, and pagination
// controls below the list when total decks exceed one page.

interface DecksSectionProps {
	tuning: SessionTuning;
	onChange: <K extends keyof SessionTuning>(key: K, value: SessionTuning[K]) => void;
	decks: ReadonlyArray<DeckRow>;
	visibleDecks: ReadonlyArray<DeckRow>;
	totalDue: number;
	allIncluded: boolean;
	noneIncluded: boolean;
	includedCount: number;
	showPagination: boolean;
	page: number;
	pageCount: number;
	onPageChange: (next: number) => void;
}

function DecksSection({
	tuning,
	onChange,
	decks,
	visibleDecks,
	totalDue,
	allIncluded,
	noneIncluded,
	includedCount,
	showPagination,
	page,
	pageCount,
	onPageChange,
}: DecksSectionProps): React.JSX.Element {
	return (
		<div>
			<div className="mb-4 flex items-center justify-between gap-3">
				<p className="text-sm text-faded-sumi tabular-nums">
					Studying
					{" "}
					{includedCount}
					{" "}
					of
					{" "}
					{decks.length}
					{" "}
					decks,
					{totalDue}
					{" "}
					cards total
				</p>
				<div className="flex items-center gap-2">
					<ActionLink
						label="All"
						disabled={allIncluded}
						onClick={() => onChange("includedDeckIds", null)}
					/>
					<span aria-hidden="true" className="text-soft-hairline">·</span>
					<ActionLink
						label="None"
						disabled={noneIncluded}
						onClick={() => onChange("includedDeckIds", [])}
					/>
				</div>
			</div>

			<SetupDeckList
				decks={visibleDecks}
				includedDeckIds={tuning.includedDeckIds}
				onToggle={(deckId, next) => {
					const current: ReadonlyArray<string>
						= tuning.includedDeckIds ?? decks.map(d => d.id);
					const updated = next
						? Array.from(new Set([...current, deckId]))
						: current.filter(id => id !== deckId);
					const isAll = updated.length === decks.length;
					onChange("includedDeckIds", isAll ? null : updated);
				}}
			/>

			{showPagination && (
				<Pagination
					page={page}
					pageCount={pageCount}
					onChange={onPageChange}
				/>
			)}
		</div>
	);
}

// ── Pagination ──────────────────────────────────────────────────────────────

function Pagination({
	page,
	pageCount,
	onChange,
}: {
	page: number;
	pageCount: number;
	onChange: (next: number) => void;
}): React.JSX.Element {
	const isFirst = page === 0;
	const isLast = page >= pageCount - 1;
	return (
		<nav
			aria-label="Deck pages"
			className="mt-4 flex items-center justify-center gap-4"
		>
			<PageButton
				direction="left"
				ariaLabel="Previous page"
				disabled={isFirst}
				onClick={() => onChange(page - 1)}
			/>
			<span className="font-mono text-sm tabular-nums text-faded-sumi">
				{page + 1}
				{" "}
				/
				{pageCount}
			</span>
			<PageButton
				direction="right"
				ariaLabel="Next page"
				disabled={isLast}
				onClick={() => onChange(page + 1)}
			/>
		</nav>
	);
}

function PageButton({
	direction,
	ariaLabel,
	disabled,
	onClick,
}: {
	direction: "left" | "right";
	ariaLabel: string;
	disabled: boolean;
	onClick: () => void;
}): React.JSX.Element {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"inline-flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-xs",
				"border border-soft-hairline",
				"text-sumi-ink hover:bg-cream-inset/60 hover:border-faded-sumi",
				"disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-soft-hairline",
				"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
				"transition-colors duration-150 ease-out",
			)}
		>
			<ArrowGlyph direction={direction} />
		</button>
	);
}

// ── Why these defaults? ────────────────────────────────────────────────────
// Quiet, collapsed-by-default disclosure of *when* to deviate from each
// setting. Targets the Anki-escapee persona who wants algorithmic context
// without imposing on the calm-practitioner persona who just wants to
// press Start. Uses <details>/<summary> so keyboard and screen-reader
// support is free and toggle state survives without React state.

function WhyTheseDefaults(): React.JSX.Element {
	return (
		<details className="group mt-6 border-t border-soft-hairline/70 pt-4">
			<summary
				className={cn(
					"inline-flex cursor-pointer items-center gap-2 select-none",
					"font-mono text-sm text-faded-sumi",
					"hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					"transition-colors duration-150 ease-out",
					"[&::-webkit-details-marker]:hidden",
				)}
			>
				<span
					aria-hidden="true"
					className="inline-block w-2 transition-transform duration-200 ease-out group-open:rotate-90"
				>
					›
				</span>
				Why these defaults?
			</summary>
			<dl className="mt-4 grid gap-4 text-sm leading-relaxed text-faded-sumi">
				<Reasoning term="Session size">
					The default caps a session at the size most learners finish without
					fatigue. Raise it on a calm morning, lower it when life is loud.
				</Reasoning>
				<Reasoning term="Include new cards">
					New cards expand your active deck and cost more time per card than
					a review. Turn off on backlog days, on travel days, or when you just
					want to clear what&rsquo;s due.
				</Reasoning>
				<Reasoning term="Review order">
					Urgency surfaces the most-overdue cards first, which is how FSRS
					expects them to be answered. Difficulty puts the hardest cards
					first while you&rsquo;re fresh. Shuffle removes the deck&rsquo;s
					implicit ordering signal.
				</Reasoning>
				<Reasoning term="Overdue first">
					A focused mode for catch-up days: only overdue cards, no new cards.
					Use it to bring a stale queue back to current without interleaving
					fresh material.
				</Reasoning>
			</dl>
		</details>
	);
}

function Reasoning({
	term,
	children,
}: {
	term: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div>
			<dt className="font-mono text-sm text-sumi-ink/80">
				{term}
			</dt>
			<dd className="mt-1.5 max-w-measure-wide">{children}</dd>
		</div>
	);
}

// ── Bits ───────────────────────────────────────────────────────────────────

function ActionLink({
	label,
	disabled,
	onClick,
}: {
	label: string;
	disabled: boolean;
	onClick: () => void;
}): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"inline-flex items-center pointer-coarse:min-h-11",
				"font-mono text-sm",
				"text-faded-sumi hover:text-sumi-ink",
				"disabled:opacity-40 disabled:cursor-not-allowed",
				"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
			)}
		>
			{label}
		</button>
	);
}
