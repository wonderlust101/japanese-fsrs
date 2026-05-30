"use client";

import type { ApiDeck } from "@fsrs-japanese/shared-types";

import type { ActiveDialog } from "./use-deck-list-actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarActions } from "@/app/(app)/_components/top-bar-actions";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { IconPlus } from "@/components/icons/chrome-marks";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";

import { PageLoader } from "@/components/ui/TomoLoader";
import { useDecksDevState } from "@/dev/panels/decks";
import { listDecksAction } from "@/lib/actions/decks.actions";
import { queryKeys } from "@/lib/api/queryKeys";
import { BulkDeleteDecksDialog } from "./bulk-delete-decks-dialog";
import { CreateDeckDialog } from "./create-deck-dialog";
import { DeckCard } from "./deck-card";
import {
	DeleteDeckDialog,
	EditDeckOptionsDialog,
	RenameDeckDialog,
} from "./deck-dialogs";
import { EmptyState, ErrorState, NoMatchesState } from "./deck-list-states";
import { truncate } from "./deck-sort";
import { DecksCurateBar } from "./decks-curate-bar";
import { DecksHeader } from "./decks-header";
import { DecksPagination } from "./decks-pagination";
import { DecksTabs } from "./decks-tabs";
import { DecksUtilityRow } from "./decks-utility-row";
import { MatureExplainer } from "./mature-explainer";
import { useDeckDragReorder } from "./use-deck-drag-reorder";
import { useDeckListActions } from "./use-deck-list-actions";
import { useDeckListFiltering } from "./use-deck-list-filtering";
import { useDeckListSelection } from "./use-deck-list-selection";
import { useDeckListSummary } from "./use-deck-list-summary";
import { useArchiveSet, useLocalNameOverrides, useStudyOrder, useViewPrefs } from "./use-deck-prefs";
import { useDeckStatsMap } from "./use-deck-stats-map";

// ─── Component ────────────────────────────────────────────────────────────
//
// Thin orchestrator: it wires data + per-device persistent state into four
// co-located hooks — selection (curate mode), filtering (search/sort/paginate
// → visible decks), summary (header counts + variant), and actions (mutations,
// toasts, a11y announcements) — then renders. The logic those hooks own used to
// live inline here; see the `use-deck-list-*` files beside this one.

export function DeckListView(): React.JSX.Element {
	const queryClient = useQueryClient();

	// ── Data ──────────────────────────────────────────────────────────────
	const dev = useDecksDevState();
	const { data, isLoading: queryLoading, isError: queryError } = useQuery({
		queryKey: queryKeys.decks.list(),
		queryFn: () => listDecksAction(),
	});
	const isError = dev.forcedState === "error" ? true : queryError;
	const allDecks: ApiDeck[] = useMemo(
		() => dev.forcedState === "empty" ? [] : (data?.items ?? []),
		[data, dev.forcedState],
	);

	const knownIds = useMemo(() => allDecks.map(d => d.id), [allDecks]);

	// Subscribe to per-deck stats. The `combine` option inside the hook
	// produces stable `Map` references so the memos below don't churn
	// every render. Shares cache with each DeckCard's own useQuery.
	const { dueByDeckId, matureByDeckId, pending: detailsPending } = useDeckStatsMap(allDecks);
	const isLoading = dev.forcedState === "loading" ? true : (queryLoading || detailsPending);

	// ── Persistent state ──────────────────────────────────────────────────
	// View prefs + study order still live in localStorage (no backend
	// representation yet). Archive state migrated to the server in 2026-05-19;
	// `useArchiveSet` is now a thin wrapper around `useDecks` + the
	// archive/unarchive mutations.
	const { prefs, setSort, setTypeFilter, setView } = useViewPrefs();
	const studyOrder = useStudyOrder(knownIds);
	const archiveSet = useArchiveSet();
	const nameOverrides = useLocalNameOverrides();

	const displayNameOf = useCallback(
		(deck: ApiDeck) => nameOverrides.nameFor(deck.id, deck.name),
		[nameOverrides],
	);

	// ── Derived view model + interactions (co-located hooks) ────────────────
	const filtering = useDeckListFiltering({
		allDecks,
		prefs,
		archiveSet,
		studyOrder,
		dueByDeckId,
		matureByDeckId,
		displayNameOf,
	});

	const summary = useDeckListSummary({
		allDecks,
		archiveSet,
		studyOrder,
		dueByDeckId,
		matureByDeckId,
		displayNameOf,
		isLoading,
		isError,
		searchQuery: filtering.searchQuery,
		totalCount: filtering.totalCount,
	});

	const { curateMode, setCurateMode, selectedIds, toggleSelected } = useDeckListSelection();

	// Dialog state stays local — the render branches on it directly. The actions
	// hook closes/opens it (bulk-delete) via the setter passed below.
	const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: "none" });
	const utilityRowRef = useRef<HTMLElement | null>(null);

	const actions = useDeckListActions({
		archiveSet,
		studyOrder,
		displayNameOf,
		selectedIds,
		setCurateMode,
		setActiveDialog,
	});

	// Drag-to-reorder reads the visible slice + the actions announcer.
	const { dragState, handleDragHandleDown } = useDeckDragReorder({
		canReorder: filtering.canReorder,
		visibleDecks: filtering.visibleDecks,
		studyOrder,
		announceMove: actions.announceMove,
		displayNameOf,
	});

	const priorityDeckId = studyOrder.priorityDeckId;

	// ── Render ────────────────────────────────────────────────────────────

	const showCurateMode = curateMode && allDecks.length > 0;

	if (isLoading) {
		return (
			<>
				<TopBar>
					<TopBarTitle kanji="束" label="Decks" />
				</TopBar>
				<PageLoader />
			</>
		);
	}

	return (
		<>
			<TopBar>
				<TopBarTitle kanji="束" label="Decks" />
				<TopBarActions>
					<Link
						href="/decks/premade"
						className="ui-motion-colors hidden h-8 items-center rounded-xs px-3 font-mono text-xs text-faded-sumi hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 sm:inline-flex"
					>
						Browse premade
					</Link>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => setActiveDialog({ kind: "create" })}
						leadingIcon={<IconPlus className="h-3.5 w-3.5" />}
					>
						New deck
					</Button>
				</TopBarActions>
			</TopBar>

			<div
				className={[
					"ui-motion-colors min-h-screen pb-32",
					showCurateMode ? "bg-cool-paper-shade" : "bg-cool-paper-base",
				].join(" ")}
			>
				<div className="relative mx-auto max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16">
					<DecksHeader variant={summary.headerVariant} />

					{/* Top-level tabs and curate bar. Hidden in the empty state because
              there's nothing to sort, filter, or page through yet. */}
					{!(summary.headerVariant.kind === "empty") && (
						<>
							<div className="relative mt-4">
								<DecksTabs
									view={prefs.view}
									counts={{ active: summary.activeCount, mature: summary.matureTabCount, archived: summary.archivedCount }}
									panelId="decks-list-panel"
									onChange={setView}
								/>
								{/* First-visit teach for the Mature concept. Self-gated by
                    localStorage; renders nothing after the user dismisses. */}
								<MatureExplainer />
							</div>
							<section ref={(node) => { utilityRowRef.current = node; }}>
								<DecksUtilityRow
									sort={prefs.sort}
									typeFilter={prefs.typeFilter}
									searchQuery={filtering.searchInputValue}
									curateActive={curateMode}
									onSort={setSort}
									onTypeFilter={setTypeFilter}
									onSearchQuery={filtering.setSearchInputValue}
									onCurate={() => setCurateMode(v => !v)}
								/>
							</section>
						</>
					)}

					{/* Deck list. `flex flex-col gap-y-3` (12px) was previously `flex flex-col gap-y-2`
              (8px) — the tighter spacing read as cramped against the
              richer DeckCard chrome (title, kanji eyebrow, progress
              bar, stats row). 12px lets each card breathe without
              breaking the list's visual cohesion. */}
					<section
						id="decks-list-panel"
						role="tabpanel"
						aria-label="Deck list"
						aria-labelledby={`decks-tab-${prefs.view}`}
						tabIndex={0}
						className="mt-3 flex flex-col gap-y-3 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-4"
					>
						{/* Polite announcer for reorder commits (pointer-drag, kebab
                Move up / Move down, bulk Move to top). Hidden visually,
                spoken by SRs. */}
						<p className="sr-only" aria-live="polite" aria-atomic="true">
							{actions.liveMessage}
						</p>

						{!isLoading && isError && (
							<ErrorState
								onRetry={() => {
									void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() });
								}}
							/>
						)}

						{!isLoading && !isError && allDecks.length === 0 && (
							<EmptyState onCreate={() => setActiveDialog({ kind: "create" })} />
						)}

						{!isLoading && !isError && allDecks.length > 0 && filtering.visibleDecks.length === 0 && (
							<NoMatchesState
								query={filtering.searchQuery}
								view={prefs.view}
								typeFilter={prefs.typeFilter}
							/>
						)}

						{!isLoading && !isError && filtering.visibleDecks.map((deck, viewIndex) => {
							const isPriority = !archiveSet.isArchived(deck.id) && deck.id === priorityDeckId;
							const slotIndex = filtering.slotByDeckId.get(deck.id) ?? null;
							const isArchived = archiveSet.isArchived(deck.id);
							const isDragging = dragState?.draggedId === deck.id;
							const isDropTarget = dragState?.overIndex === viewIndex && dragState?.draggedId !== deck.id;
							const orderIndex = studyOrder.resolvedOrder.indexOf(deck.id);

							return (
								<DeckCard
									key={deck.id}
									deck={deck}
									displayName={displayNameOf(deck)}
									slotIndex={isArchived ? null : slotIndex}
									viewIndex={viewIndex}
									isPriority={isPriority}
									isArchived={isArchived}
									curateMode={curateMode}
									selected={selectedIds.has(deck.id)}
									dragEnabled={filtering.canReorder && !isArchived}
									isDragging={isDragging}
									isDropTarget={isDropTarget}
									canMoveUp={!isArchived && orderIndex > 0}
									canMoveDown={!isArchived && orderIndex >= 0 && orderIndex < studyOrder.resolvedOrder.length - 1}
									onToggleSelect={() => toggleSelected(deck.id)}
									onSetAsPriority={() => actions.handleSetAsPriority(deck.id, displayNameOf(deck))}
									onRename={() => setActiveDialog({ kind: "rename", deck })}
									onCopy={() => actions.handleCopy(deck.id, displayNameOf(deck))}
									onEditOptions={() => setActiveDialog({ kind: "edit", deck })}
									onArchive={() => actions.handleArchive(deck.id, displayNameOf(deck))}
									onRestore={() => actions.handleRestore(deck.id, displayNameOf(deck))}
									onDelete={() => setActiveDialog({ kind: "delete", deck })}
									onMoveUp={() => actions.handleMoveUp(deck)}
									onMoveDown={() => actions.handleMoveDown(deck)}
									onDragHandleDown={handleDragHandleDown(deck.id, viewIndex)}
								/>
							);
						})}
					</section>

					{!isLoading && !isError && filtering.visibleDecks.length > 0 && (
						<DecksPagination
							page={filtering.safePage}
							pageSize={filtering.pageSize}
							totalCount={filtering.totalCount}
							scrollTargetEl={utilityRowRef as React.RefObject<HTMLElement | null>}
							onPickPage={filtering.setPage}
							onPrev={() => filtering.setPage(p => Math.max(1, p - 1))}
							onNext={() => filtering.setPage(p => Math.min(filtering.totalPages, p + 1))}
							onPageSizeChange={filtering.setPageSize}
						/>
					)}

				</div>

				{/* Curate bar lives inside the outer content wrapper so its
            sticky-bottom positioning is constrained to the main column
            width (i.e., viewport minus the desktop sidebar). Was a
            viewport-fixed overlay before, which spanned under the
            sidebar. Background tone of the wrapper is intentionally
            left alone per the request. */}
				{showCurateMode && (
					<DecksCurateBar
						selectedCount={selectedIds.size}
						totalCount={allDecks.length}
						canReorder={filtering.canReorder}
						onDone={() => setCurateMode(false)}
						onMoveToTop={actions.handleBulkMoveToTop}
						onArchive={actions.handleBulkArchive}
						onCopy={actions.handleBulkCopy}
						onDelete={() => setActiveDialog({ kind: "bulk-delete" })}
					/>
				)}
			</div>

			<CreateDeckDialog
				open={activeDialog.kind === "create"}
				onClose={() => setActiveDialog({ kind: "none" })}
			/>

			<BulkDeleteDecksDialog
				open={activeDialog.kind === "bulk-delete"}
				selectedCount={selectedIds.size}
				onClose={() => setActiveDialog({ kind: "none" })}
				onConfirm={() => actions.handleBulkDelete()}
			/>

			<RenameDeckDialog
				open={activeDialog.kind === "rename"}
				deck={activeDialog.kind === "rename" ? activeDialog.deck : null}
				currentName={activeDialog.kind === "rename" ? displayNameOf(activeDialog.deck) : ""}
				onClose={() => setActiveDialog({ kind: "none" })}
				onLocalRename={(id, name) => nameOverrides.setNameOverride(id, name)}
				onError={msg => actions.showToast(msg, "error")}
				onSuccess={name => actions.showToast(`Renamed to "${truncate(name, 28)}".`)}
			/>

			<DeleteDeckDialog
				open={activeDialog.kind === "delete"}
				deck={activeDialog.kind === "delete" ? activeDialog.deck : null}
				cardCount={activeDialog.kind === "delete" ? activeDialog.deck.cardCount : 0}
				onClose={() => setActiveDialog({ kind: "none" })}
				onError={msg => actions.showToast(msg, "error")}
				onSuccess={(name) => {
					if (activeDialog.kind === "delete") {
						nameOverrides.setNameOverride(activeDialog.deck.id, null);
						archiveSet.restore(activeDialog.deck.id);
					}
					actions.showToast(`Deleted "${truncate(name, 28)}".`);
				}}
			/>

			<EditDeckOptionsDialog
				open={activeDialog.kind === "edit"}
				deck={activeDialog.kind === "edit" ? activeDialog.deck : null}
				isArchived={activeDialog.kind === "edit" ? archiveSet.isArchived(activeDialog.deck.id) : false}
				onClose={() => setActiveDialog({ kind: "none" })}
				onLocalRename={(id, name) => nameOverrides.setNameOverride(id, name)}
				onArchive={id => archiveSet.archive(id)}
				onRestore={id => archiveSet.restore(id)}
				onError={msg => actions.showToast(msg, "error")}
				onSuccess={msg => actions.showToast(msg)}
			/>

			{actions.toast !== null && (
				<Toast
					key={actions.toast.key}
					message={actions.toast.message}
					kind={actions.toast.kind}
					onDismiss={actions.dismissToast}
					// 5s window when there's an Undo affordance, otherwise the
					// Toast component's default (3.2s for info, persist for error).
					{...(actions.toast.action !== undefined ? { action: actions.toast.action, durationMs: 5000 } : {})}
				/>
			)}
		</>
	);
}
