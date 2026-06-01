"use client";

import type { CardsPageSize } from "./cards-pagination";
import type { CardQualityIssue, CardQualityIssueKind } from "./cards-quality-data";

import type { CardsResultRow } from "./cards-results-table";
import type { DeckOption } from "./cards-toolbar";
import type { CrossDeckCardsActionOptions } from "@/lib/actions/cards.actions";
import {
	getWordFields,

} from "@fsrs-japanese/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { MoveCardDialog } from "@/app/(app)/decks/[id]/_components/move-card-dialog";
import { ModuleError } from "@/components/ui/ModuleError";
import { PAGE_HEADER_PADDING, PageHeader } from "@/components/ui/PageHeader";
import { Toast, useToast } from "@/components/ui/Toast";

import { PageLoader } from "@/components/ui/TomoLoader";
import { useCardsDevState } from "@/dev/panels/cards";
import { useRevealMount } from "@/hooks/use-reveal-mount";
import { listDecksAction } from "@/lib/actions/decks.actions";
import {
	useCardQualityIssuesQuery,
	useCardsCrossDeckQuery,
} from "@/lib/api/cards";
import { queryKeys } from "@/lib/api/queryKeys";
import { CardsActiveChips } from "./cards-active-chips";
import { ConfirmDeleteDialog, FirstRunEmptyState } from "./cards-browser-states";
import { CardsBulkBar } from "./cards-bulk-bar";
import { bulkMoveSyntheticCard, toResultRow } from "./cards-card-rows";
import { CardsCountLine } from "./cards-count-line";
import { CardsFilterSheet } from "./cards-filter-sheet";
import {
	chipsFromState,
	effectiveSortDir,
	hasAnyFilter,
	naturalSortDirFor,
	stateMatchesRecipe,

} from "./cards-filter-state";
import { CardsPagination } from "./cards-pagination";
import {
	CardsResultsTable,

} from "./cards-results-table";
import { CardsToolbar } from "./cards-toolbar";
import {
	findViewById,
} from "./saved-views-storage";
import { useCardsKeyboardShortcuts } from "./use-cards-keyboard-shortcuts";
import { useCardsRowActions } from "./use-cards-row-actions";
import { useCardsSelection } from "./use-cards-selection";
import { useCardsUrlFilterState } from "./use-cards-url-filter-state";

const DEFAULT_PAGE_SIZE: CardsPageSize = 25;

export function CardsBrowserView(): React.JSX.Element {
	const {
		state,
		updateState,
		handleSearchChange,
		handlePickView,
		handleClearAll,
	} = useCardsUrlFilterState();

	// ── Pagination state. ────────────────────────────────────────────────
	// `state.page` is the source of truth for the current page (lives in
	// URL via cards-filter-state). The cursor stack is gone since the
	// backend switched to offset pagination in 20260630000003.
	const [pageSize, setPageSize] = useState<CardsPageSize>(DEFAULT_PAGE_SIZE);
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
	const pageIndex = state.page - 1; // 0-indexed internal use only

	// Page-level F (add-filter) / V (view-picker) keyboard shortcuts. The
	// popover open-state + view-trigger ref are surfaced for the toolbar.
	const { addFilterOpen, setAddFilterOpen, viewTriggerClickRef } = useCardsKeyboardShortcuts();

	const { toast, showToast, dismissToast } = useToast();

	// ── Decks list (for the deck filter picker). ─────────────────────────
	const { data: decksList } = useQuery({
		queryKey: queryKeys.decks.list(),
		queryFn: () => listDecksAction(),
	});
	const liveDecks: ReadonlyArray<DeckOption> = useMemo(
		() => (decksList?.items ?? []).map(d => ({ id: d.id, name: d.name })),
		[decksList],
	);

	// ── Dev panel + fixture rows. ────────────────────────────────────────
	const devState = useCardsDevState();
	const usingFixture = devState.fixture !== "off";
	const decks: ReadonlyArray<DeckOption> = usingFixture ? devState.decks : liveDecks;

	// ── Cross-deck list query options derived from URL state. ────────────
	const queryOpts = useMemo<CrossDeckCardsActionOptions>(() => {
		const opts: CrossDeckCardsActionOptions = {
			limit: pageSize,
			sort: state.sort,
			// sortDir omitted when null (means "natural default for this
			// axis"); the action layer skips the URL param too so the
			// backend uses its per-axis default.
			...(state.sortDir !== null ? { sortDir: state.sortDir } : {}),
		};
		// Offset pagination (replaces the cursor stack as of 20260630000003).
		// `state.page` is 1-indexed; we translate to 0-based offset rows.
		const offset = pageIndex * pageSize;
		if (offset > 0)
			opts.offset = offset;
		if (state.search.trim().length > 0)
			opts.search = state.search.trim();
		if (state.deckId !== "all")
			opts.deckId = state.deckId;
		if (state.jlpt !== "all")
			opts.jlptLevel = state.jlpt as NonNullable<CrossDeckCardsActionOptions["jlptLevel"]>;
		if (state.status !== "all")
			opts.status = state.status as NonNullable<CrossDeckCardsActionOptions["status"]>;
		if (state.missingField !== null)
			opts.missingField = state.missingField;
		if (state.presentField !== null)
			opts.presentField = state.presentField;
		if (state.pitchPattern !== null && state.presentField === "pitch") {
			opts.pitchPattern = state.pitchPattern;
		}
		return opts;
	}, [state, pageSize, pageIndex]);

	const liveQuery = useCardsCrossDeckQuery(queryOpts);
	const qualityQuery = useCardQualityIssuesQuery();

	// ── Data sources: live or fixtures. ──────────────────────────────────
	const rows: ReadonlyArray<CardsResultRow> = useMemo(() => {
		if (usingFixture) {
			const start = pageIndex * pageSize;
			return devState.rows.slice(start, start + pageSize);
		}
		const items = liveQuery.data?.items ?? [];
		return items.map(toResultRow);
	}, [usingFixture, devState.rows, liveQuery.data, pageIndex, pageSize]);

	const totalCount = usingFixture ? devState.rows.length : (liveQuery.data?.totalCount ?? 0);
	// Cold boot only: no data has ever loaded. With `placeholderData:
	// keepPreviousData` on the underlying hook, this stays true only on
	// the very first paint. Subsequent refetches (filter, sort, search,
	// page change) keep the prior data on screen and flip `isFetching`,
	// not `isLoading`, so the toolbar/chrome stays interactive and the
	// table shows a row-level skeleton via `isPaginating`.
	const coldBoot = usingFixture ? devState.loading : liveQuery.isLoading;
	const tableLoading = coldBoot;
	// Fixture mode has no asynchronous fetch, so it never paginates
	// visibly — the table just swaps. The fixture-paging timer that
	// used to simulate a network delay was removed alongside the cursor
	// stack since the live path now uses keepPreviousData for the same
	// visual continuity.
	const isPaginating = usingFixture
		? false
		: (liveQuery.isFetching && !liveQuery.isLoading);

	// Id-keyed bulk selection (+ clear-on-filter-change, NOT on page nav).
	// See use-cards-selection.
	const { selected, toggleSelection, toggleAllVisible, clearSelection } = useCardsSelection(rows, state, pageSize);

	// ── Quality issues — maps backend kinds to the view-count enum. ──────
	const qualityIssues: ReadonlyArray<CardQualityIssue> = useMemo(() => {
		if (qualityQuery.data === undefined)
			return [];
		return qualityQuery.data.map(i => ({
			kind: i.issueType as CardQualityIssueKind,
			count: i.count,
		}));
	}, [qualityQuery.data]);

	// ── Active-view "modified" indicator. ────────────────────────────────
	const activeView = findViewById(state.viewId);
	const activeViewModified = useMemo(() => {
		if (activeView === undefined)
			return false;
		return !stateMatchesRecipe(state, activeView.recipe);
	}, [activeView, state]);

	// ── Row + bulk actions: the six card mutations, the dialog-target state
	// each action drives, and their handlers. The router + mutations live in
	// the hook; the render reads `isPending`/`error` + dialog state off this.
	const {
		deleteMutation,
		moveMutation,
		copyMutation,
		bulkMoveMutation,
		bulkDeleteMutation,
		confirmDelete,
		setConfirmDelete,
		moveTarget,
		setMoveTarget,
		copyTarget,
		setCopyTarget,
		bulkMoveOpen,
		setBulkMoveOpen,
		bulkDeleteOpen,
		setBulkDeleteOpen,
		handleRowAction,
		confirmRowDelete,
		handleMoveConfirm,
		handleCopyConfirm,
		handleBulkMoveConfirm,
		handleBulkSuspend,
		handleBulkDeleteConfirm,
	} = useCardsRowActions({ items: liveQuery.data?.items, selected, clearSelection, showToast });

	// ── Pagination handlers. ─────────────────────────────────────────────
	// All three handlers mutate `state.page` via `updateState`, which
	// pushes the new page into the URL. Bounds enforcement happens here
	// so the pagination component can call them naively.
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	function handlePickPage(nextPage: number): void {
		const clamped = Math.min(Math.max(1, Math.floor(nextPage)), totalPages);
		if (clamped === state.page)
			return;
		updateState({ ...state, page: clamped });
	}
	function handlePrev(): void {
		if (state.page <= 1)
			return;
		updateState({ ...state, page: state.page - 1 });
	}
	function handleNext(): void {
		if (state.page >= totalPages)
			return;
		updateState({ ...state, page: state.page + 1 });
	}
	// Page size lives in local state, not the URL. Reset to page 1 on a size
	// change so a larger window can't strand the user on an offset past the new
	// last page (e.g. page 4 at 25/page lands beyond the data at 50/page). Page 1
	// is always valid, which also removes the need to clamp here.
	function handlePageSizeChange(nextSize: CardsPageSize): void {
		setPageSize(nextSize);
		if (state.page !== 1)
			updateState({ ...state, page: 1 });
	}

	// Page-level reveal (mount mode). Reveals the HEADER lead + the TOOLBAR
	// chrome only — never the results table/rows (they stay static for instant
	// scanning + find-in-page; spec §P2.6). Attaches to the content column;
	// re-runs when the main branch (vs cold-boot loader / error) mounts.
	const contentRef = useRef<HTMLDivElement | null>(null);
	const mainBranchShowing = !((!usingFixture && liveQuery.isError && liveQuery.data === undefined) || coldBoot);
	useRevealMount(contentRef, { deps: [mainBranchShowing] });

	// First-deck-id helper for the bulk Move dialog.
	const bulkMoveCurrentDeckId = useMemo(() => {
		const firstId = [...selected][0];
		if (firstId === undefined)
			return "";
		return rows.find(r => r.id === firstId)?.deckId ?? "";
	}, [selected, rows]);

	const chips = chipsFromState(state);
	const filtersActive = hasAnyFilter(state);
	const mobileChipCount = chips.length + (state.deckId !== "all" ? 1 : 0);
	// First-run empty state. Distinct from "filters narrowed to zero":
	// brand-new users land here with literally no cards in any deck, and
	// need orientation, not a "no results" message.
	//
	// Two ways to enter this branch:
	//   1. Live mode with literally zero cards and no filters applied.
	//   2. The dev panel's `first-run` fixture, which explicitly tests
	//      this surface without needing a real account at totalCount=0.
	// Other fixtures (`few`, `many`, etc.) continue to render the table
	// chrome since QA review wants the table for that case.
	//
	// CRITICAL: live-mode also guards against `liveQuery.isFetching`.
	// A sort-direction toggle (or any state change that invalidates
	// pagination) briefly fires a query with the new opts but the
	// pre-reset cursor; that query can return zero rows transiently
	// before the pagination-reset effect re-fetches cleanly. Without
	// this guard, the empty state mistakenly flashes during that gap.
	const firstRunEmpty = usingFixture
		? devState.simulateFirstRun
		: (totalCount === 0 && !filtersActive && !liveQuery.isFetching);

	// Cold-boot fetch failure: the list never loaded, so there is no prior data
	// to fall back on (keepPreviousData only retains a *previous* success). Show a
	// retryable error rather than the "No cards yet" empty state, which would
	// falsely claim the account has no cards. A refetch error *after* a success
	// leaves `data` defined, so this never blanks already-visible rows.
	if (!usingFixture && liveQuery.isError && liveQuery.data === undefined) {
		return (
			<>
				<div className="mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-12 lg:px-16">
					<ModuleError label="your cards" onRetry={() => void liveQuery.refetch()} />
				</div>
			</>
		);
	}

	if (coldBoot) {
		return (
			<>
				<PageLoader />
			</>
		);
	}

	return (
		<>

			{/* Outer wrapper is a flex column so the bulk bar always sits at
          the very bottom of the page regardless of content height.
          - On a short page (e.g. 22 cards), the inner content column
            takes flex-1 and grows to fill, pushing the bar to the
            viewport bottom.
          - On a long page, content overflows and the bar sticks to
            the viewport's bottom via `position: sticky bottom-0`.
          - At absolute end of scroll, the bar's natural position IS
            the viewport bottom (because there's no padding below it).
          The previous `pb-16` is gone for the same reason: dead space
          below the bar prevented it from staying pinned at full
          scroll. The inner content column keeps its own `pb-20` for
          spacing between the table and the bar. */}
			<div className="flex min-h-screen flex-col bg-cool-paper-base">
				<div ref={contentRef} className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-4 pb-20 md:px-12 lg:px-16">

					{/* ── Page header ───────────────────────────────────────── */}
					<div className={PAGE_HEADER_PADDING}>
						<PageHeader
							kanji="字"
							label="Cards"
							title="All cards"
							subtitle="Every card across every deck. Pick a view, refine with chips."
							revealLead
						/>
					</div>

					{/* ── Toolbar (one row on desktop) ──────────────────────── */}
					<CardsToolbar
						state={state}
						decks={decks}
						qualityIssues={qualityIssues}
						activeViewModified={activeViewModified}
						onSearchChange={handleSearchChange}
						onStateChange={updateState}
						onPickView={handlePickView}
						addFilterOpen={addFilterOpen}
						onAddFilterOpenChange={setAddFilterOpen}
						viewTriggerRef={viewTriggerClickRef}
						onOpenMobileSheet={() => setMobileSheetOpen(true)}
						mobileChipCount={mobileChipCount}
						reveal
					/>

					{/* ── Active filter chips ─────────────────────────────────
              Desktop: full interactive chip strip (click body to edit,
              ✕ to remove). Wraps to multiple lines when needed.

              Mobile: separate horizontal-scroll rail with tap-to-remove
              only. Body taps do nothing; editing routes through the
              filter sheet. The two variants share the same component
              file so the chip projection logic stays single-sourced. */}
					{chips.length > 0 && (
						<>
							<div className="mt-3 hidden sm:block">
								<CardsActiveChips
									state={state}
									onChange={updateState}
									onClearAll={handleClearAll}
									variant="desktop"
								/>
							</div>
							<div className="mt-3 sm:hidden">
								<CardsActiveChips
									state={state}
									onChange={updateState}
									onClearAll={handleClearAll}
									variant="mobile"
								/>
							</div>
						</>
					)}

					{firstRunEmpty ? (
						<div className="animate-memory-fade-in">
							<FirstRunEmptyState />
						</div>
					) : (
						<>
							{/* ── Result count + Sort dropdown ───────────────────────
                  Sort moved here from the toolbar's Row 2 because it isn't
                  a filter; pairing it with the count it actually affects
                  matches the Linear / Vercel pattern. The "Clear all"
                  affordance lives only inside the chip strip now to avoid
                  the duplicate-control noise the critique flagged. */}
							<div className="mt-4" data-reveal="">
								<CardsCountLine
									totalCount={totalCount}
									sort={state.sort}
									sortDir={state.sortDir}
									// Changing the sort axis resets sortDir to the per-axis
									// natural default (encoded as null) so the user doesn't
									// get a confusing "I picked Sort by Due but it's still
									// descending from when I had Lapses" state.
									onPickSort={sort => updateState({ ...state, sort, sortDir: null })}
									onToggleSortDir={() => {
										const current = effectiveSortDir(state);
										const flipped: "asc" | "desc" = current === "asc" ? "desc" : "asc";
										// If the toggle lands back on the natural default,
										// clear sortDir (so the URL stays clean and the
										// state shows "I haven't overridden anything").
										const natural = naturalSortDirFor(state.sort);
										updateState({
											...state,
											sortDir: flipped === natural ? null : flipped,
										});
									}}
									trailingNote={
										filtersActive && chips.length === 0 && state.search.length > 0
											? (
													<>
														{" matching "}
														<span className="text-sumi-ink">
															“
															{state.search}
															”
														</span>
													</>
												)
											: undefined
									}
								/>
							</div>

							{/* ── Results ──────────────────────────────────────────── */}
							<div className="mt-3" data-reveal="">
								<CardsResultsTable
									rows={rows}
									onRowAction={handleRowAction}
									loading={tableLoading}
									paginating={isPaginating}
									selectedIds={selected}
									onToggleSelection={toggleSelection}
									onToggleAllVisible={toggleAllVisible}
								/>
								{!tableLoading && totalCount > 0 && (
									<CardsPagination
										pageIndex={pageIndex}
										pageSize={pageSize}
										totalCount={totalCount}
										onPickPage={handlePickPage}
										onPrev={handlePrev}
										onNext={handleNext}
										onPageSizeChange={handlePageSizeChange}
										isPaginating={isPaginating}
									/>
								)}
							</div>
						</>
					)}
				</div>

				{/* ── Sticky bulk-actions bar. ─────────────────────────────────
            Rendered inside the main content column wrapper (not as a
            top-level sibling) so its `position: sticky` finds the
            correct scroll container and the bar's width matches the
            column. This is what keeps the bar from bleeding across
            the sidebar on desktop. */}
				{selected.size > 0 && (
					<CardsBulkBar
						selectedCount={selected.size}
						onMove={() => setBulkMoveOpen(true)}
						onSuspend={handleBulkSuspend}
						onDelete={() => setBulkDeleteOpen(true)}
						onClear={clearSelection}
					/>
				)}
			</div>

			{/* ── Mobile filter sheet ──────────────────────────────────────── */}
			<CardsFilterSheet
				open={mobileSheetOpen}
				state={state}
				decks={decks}
				onChange={updateState}
				onClearAll={handleClearAll}
				onClose={() => setMobileSheetOpen(false)}
			/>

			{/* ── Dialogs ──────────────────────────────────────────────────── */}
			<MoveCardDialog
				card={moveTarget}
				currentDeckId={moveTarget?.deckId ?? ""}
				variant="move"
				isSubmitting={moveMutation.isPending}
				errorMessage={moveMutation.error?.message ?? null}
				onCancel={() => setMoveTarget(null)}
				onConfirm={(card, targetDeckId) => handleMoveConfirm(card, targetDeckId)}
			/>
			<MoveCardDialog
				card={copyTarget}
				currentDeckId={copyTarget?.deckId ?? ""}
				variant="add"
				isSubmitting={copyMutation.isPending}
				errorMessage={copyMutation.error?.message ?? null}
				onCancel={() => setCopyTarget(null)}
				onConfirm={(card, targetDeckId) => handleCopyConfirm(card, targetDeckId)}
			/>

			<MoveCardDialog
				card={bulkMoveOpen ? bulkMoveSyntheticCard(selected.size) : null}
				currentDeckId={bulkMoveCurrentDeckId}
				variant="move"
				isSubmitting={bulkMoveMutation.isPending}
				errorMessage={bulkMoveMutation.error?.message ?? null}
				onCancel={() => setBulkMoveOpen(false)}
				onConfirm={handleBulkMoveConfirm}
			/>

			<ConfirmDeleteDialog
				open={confirmDelete !== null}
				title="Delete this card?"
				description={confirmDelete !== null
					? `Delete ${getWordFields(confirmDelete)?.word ?? "this card"}? Its review history will be removed permanently.`
					: ""}
				isSubmitting={deleteMutation.isPending}
				onCancel={() => setConfirmDelete(null)}
				onConfirm={confirmRowDelete}
			/>

			<ConfirmDeleteDialog
				open={bulkDeleteOpen}
				title={`Delete ${selected.size} ${selected.size === 1 ? "card" : "cards"}?`}
				description="Their review history will be removed permanently. This action can't be undone."
				isSubmitting={bulkDeleteMutation.isPending}
				onCancel={() => setBulkDeleteOpen(false)}
				onConfirm={handleBulkDeleteConfirm}
			/>

			{toast !== null && (
				<Toast
					key={toast.key}
					message={toast.message}
					kind={toast.kind}
					onDismiss={dismissToast}
					offset="above-bar"
					maxWidth="max-w-[32rem]"
				/>
			)}
		</>
	);
}
