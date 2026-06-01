"use client";

import type { ApiCardListItem, CardSortDir } from "@fsrs-japanese/shared-types";
import type { CardRowAction } from "@/app/(app)/cards/_components/cards-results-table";

import { keepPreviousData, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PageFrame } from "@/app/(app)/_components/page-frame";

import { SetTopBar } from "@/app/(app)/_components/set-top-bar";
import { TopBarActions } from "@/app/(app)/_components/top-bar-actions";
import { CardsBulkBar } from "@/app/(app)/cards/_components/cards-bulk-bar";
import { apiCardToRow, bulkMoveSyntheticCard, truncate } from "@/app/(app)/cards/_components/cards-card-rows";
import { CardsCountLine } from "@/app/(app)/cards/_components/cards-count-line";
import { naturalSortDirFor } from "@/app/(app)/cards/_components/cards-filter-state";
import {
	CardsResultsTable,

} from "@/app/(app)/cards/_components/cards-results-table";
import {
	DeleteDeckDialog,
	RenameDeckDialog,
} from "@/app/(app)/decks/_components/deck-dialogs";
import {
	DecksMenu,
	MenuItem,
	MenuSeparator,
} from "@/app/(app)/decks/_components/decks-menu";
import {
	useArchiveSet,
	useLocalNameOverrides,
} from "@/app/(app)/decks/_components/use-deck-prefs";
import { IconDelete, IconEdit, IconHide, IconMore, IconReveal } from "@/components/icons/chrome-marks";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toast, useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useDeckDetailDevState } from "@/dev/panels/deck-detail";
import { useRevealMount } from "@/hooks/use-reveal-mount";

import { listCardsCrossDeckAction } from "@/lib/actions/cards.actions";
import { deleteDeckAction, getDeckWithStatsAction } from "@/lib/actions/decks.actions";
import { queryKeys } from "@/lib/api/queryKeys";
import { CardListPagination } from "./card-list-pagination";
import { DeckCardToolbar } from "./deck-card-toolbar";
import { STATUS_LABEL } from "./deck-cards-url-state";
import { BulkDeleteCardsDialog, CardDeleteDialog } from "./deck-detail-dialogs";
import { CardListErrorState, EmptyDeckState, NoMatchState, StudyDeckCta } from "./deck-detail-states";
import { DeckSnapshotRibbon } from "./deck-snapshot-ribbon";
import { MoveCardDialog } from "./move-card-dialog";
import {
	useDeckCardMutations,
} from "./use-deck-card-mutations";
import { useDeckCardsBulkActions } from "./use-deck-cards-bulk-actions";
import { useDeckCardsSelection } from "./use-deck-cards-selection";
import { useDeckCardsUrlState } from "./use-deck-cards-url-state";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
	deckId: string;
	deckName: string;
}

type ActiveDialog
	= | { kind: "none" }
		| { kind: "rename" }
		| { kind: "delete" }
		| { kind: "delete-card"; card: ApiCardListItem }
		| { kind: "move-card"; card: ApiCardListItem }
		| { kind: "add-card"; card: ApiCardListItem };

// ─── Component ────────────────────────────────────────────────────────────────

export function DeckDetailView({ deckId, deckName }: Props): React.JSX.Element {
	useDeckDetailDevState();
	const router = useRouter();
	const queryClient = useQueryClient();

	// Local archive + name override state (shared with Decks page via localStorage).
	const archiveSet = useArchiveSet();
	const nameOverrides = useLocalNameOverrides();
	const isArchived = archiveSet.isArchived(deckId);
	const displayName = nameOverrides.nameFor(deckId, deckName);

	// URL-canonical filter state (status / search / sort / page) + the local
	// pageSize preference + its single writer. These live in the URL so the
	// filtered view is deep-linkable; see use-deck-cards-url-state.
	const {
		status,
		searchValue,
		sort,
		sortDir,
		pageIndex,
		pageSize,
		updateUrlState,
		handlePageSizeChange,
	} = useDeckCardsUrlState();

	const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: "none" });
	const { toast, showToast, dismissToast } = useToast();

	// Deck header stats. `gcTime: 0` pairs with `useSuspenseQuery` to evict the
	// cache on unmount so navigation back always fetches fresh data.
	const { data: deck } = useSuspenseQuery({
		queryKey: queryKeys.decks.detail(deckId),
		queryFn: () => getDeckWithStatsAction(deckId),
		gcTime: 0,
	});

	// Card list — offset-paginated against the cross-deck endpoint with
	// `deckId` as the scope filter so the toolbar's search input becomes a
	// real backend search instead of a client-side filter over already-
	// loaded pages. Resets when status / page size / search changes (all
	// part of the query key). Converted from cursor + useInfiniteQuery to
	// offset + plain useQuery in 20260630000003 so the cards page could
	// adopt random-page jump; this view inherits the simpler model since
	// its prev/next semantics map cleanly to offset.
	const trimmedSearch = searchValue.trim();
	const {
		data,
		refetch,
		isFetching: isCardsFetching,
		isLoading: cardsLoading,
		isError: cardsError,
	} = useQuery({
		queryKey: [...queryKeys.cards.byDeck(deckId), status, pageSize, trimmedSearch, sort, sortDir, pageIndex],
		queryFn: () => listCardsCrossDeckAction({
			deckId,
			limit: pageSize,
			sort,
			...(pageIndex > 0 ? { offset: pageIndex * pageSize } : {}),
			...(status !== "all" ? { status } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
			...(sortDir !== null ? { sortDir } : {}),
		}),
		placeholderData: keepPreviousData,
	});

	const visibleCards = useMemo(() => data?.items ?? [], [data]);

	// Pagination affordance state.
	const hasPrev = pageIndex > 0;
	const hasNext = (data?.hasMore ?? false) === true;

	const cardCount = deck?.cardCount ?? 0;
	const totalMatching = data?.totalCount ?? visibleCards.length;
	const isCardListEmpty = !cardsLoading && cardCount === 0;
	const filteredEmpty = !cardsLoading && cardCount > 0 && visibleCards.length === 0;
	const selectedStatusLabel = STATUS_LABEL[status];

	// ── Bulk selection (id-keyed; clears on result-set change). See
	// use-deck-cards-selection.
	const { selected, toggleSelection, toggleAllVisible, clearSelection } = useDeckCardsSelection(
		visibleCards,
		{ status, trimmedSearch, sort, sortDir, pageSize },
	);

	// ── Bulk actions (move / suspend / delete + confirm-dialog state). See
	// use-deck-cards-bulk-actions.
	const {
		bulkMoveMutation,
		bulkDeleteMutation,
		bulkMoveOpen,
		setBulkMoveOpen,
		bulkDeleteOpen,
		setBulkDeleteOpen,
		handleBulkMoveConfirm,
		handleBulkSuspend,
		handleBulkDeleteConfirm,
	} = useDeckCardsBulkActions({ selected, clearSelection, showToast });

	const { deleteCardMutation, moveCardMutation, copyCardMutation } = useDeckCardMutations(deckId);

	function handleNextPage(): void {
		if (hasNext && !isCardsFetching) {
			updateUrlState({ page: pageIndex + 2 });
		}
	}

	function handlePrevPage(): void {
		updateUrlState({ page: Math.max(1, pageIndex) });
	}

	// Maps a Cards-table row action back onto Deck Detail's existing
	// dialog/setActiveDialog vocabulary so the new menu reuses the
	// already-wired Move / Add-copy / Delete dialogs without forking a
	// parallel surface.
	function handleCardRowAction(action: CardRowAction, card: ApiCardListItem): void {
		switch (action) {
			case "edit":
				router.push(`/cards/${card.id}?from=decks`);
				return;
			case "add-copy":
				setActiveDialog({ kind: "add-card", card });
				return;
			case "move":
				setActiveDialog({ kind: "move-card", card });
				return;
			case "delete":
				setActiveDialog({ kind: "delete-card", card });
		}
	}

	// ── Mutations ─────────────────────────────────────────────────────────
	const deleteMutation = useMutation({
		mutationFn: () => deleteDeckAction(deckId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
			// The `premadeDecks.subscriptions` invalidation that lived here was
			// removed in Backend Completion Plan Stage 4 (copy model): the
			// subscription concept is gone, and "decks I copied from premade"
			// is now a client-side filter on the decks list (already invalidated
			// via decks.all() above).
			router.push("/decks");
		},
	});

	function handleArchive(): void {
		archiveSet.archive(deckId);
		showToast(`Archived "${truncate(displayName, 28)}". You can restore it from this page or the Decks list.`);
	}

	function handleRestore(): void {
		archiveSet.restore(deckId);
		showToast(`Restored "${truncate(displayName, 28)}".`);
	}

	// Page-level reveal (mount mode). Three beats: the header group (PageHeader
	// + Study CTA) lands as the lead, the snapshot ribbon settles second, and the
	// cards section (toolbar + count + table as a block) arrives third. Individual
	// card rows stay static (spec §P2.6). Re-runs once the loaded view mounts.
	const contentRef = useRef<HTMLDivElement | null>(null);
	const detailLoading = cardsLoading;
	useRevealMount(contentRef, { deps: [detailLoading] });

	// ── Render ────────────────────────────────────────────────────────────
	const studyHref = `/review/setup?deck=${encodeURIComponent(deckId)}`;
	// Study is unavailable when the deck has no cards, or when it's archived
	// (archive sets the deck aside; you restore it before studying again).
	const studyDisabled = isCardListEmpty || isArchived;
	const studyDisabledReason = isArchived
		? "Restore this deck to study it."
		: "Add a card to study this deck.";

	if (cardsLoading) {
		return (
			<>
				<SetTopBar kanji="束" label={displayName} backHref="/decks" backAriaLabel="Back to Decks" />
				<PageLoader />
			</>
		);
	}

	return (
		<>
			<SetTopBar
				kanji="束"
				label={displayName}
				backHref="/decks"
				backAriaLabel="Back to Decks"
				actions={(
					<TopBarActions>
						<DecksMenu
							align="end"
							menuClassName="min-w-[12rem]"
							renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
								<button
									ref={triggerRef}
									type="button"
									onClick={onClick}
									onKeyDown={onKeyDown}
									aria-haspopup="menu"
									aria-expanded={ariaExpanded}
									aria-label="Deck options"
									className="ui-motion-colors flex h-8 w-8 shrink-0 items-center justify-center rounded-xs text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
								>
									<IconMore className="h-4 w-4" />
								</button>
							)}
							renderItems={({ close }) => (
								<>
									<MenuItem
										leading={<IconEdit className="h-3.5 w-3.5" />}
										onClick={() => { setActiveDialog({ kind: "rename" }); close(); }}
									>
										Rename
									</MenuItem>
									<MenuSeparator />
									{isArchived
										? (
												<MenuItem
													leading={<IconReveal className="h-3.5 w-3.5" />}
													onClick={() => { handleRestore(); close(); }}
												>
													Restore
												</MenuItem>
											)
										: (
												<MenuItem
													leading={<IconHide className="h-3.5 w-3.5" />}
													onClick={() => { handleArchive(); close(); }}
												>
													Archive
												</MenuItem>
											)}
									<MenuItem
										leading={<IconDelete className="h-3.5 w-3.5" />}
										onClick={() => { setActiveDialog({ kind: "delete" }); close(); }}
										danger
									>
										Delete
									</MenuItem>
								</>
							)}
						/>
					</TopBarActions>
				)}
			/>

			<PageFrame contentRef={contentRef}>

				{/* ── Page hero + primary action ─────────────────────────────
              Header and the Study CTA are grouped into one grid child with a
              tight internal gap, so the page's larger inter-section rhythm
              only opens up *around* the pair — the button sits close under
              the title instead of floating in a full grid gap. The CTA is
              left-aligned on the reading edge and desktop-only (phones use the
              sticky bottom bar). */}
				<div className="flex flex-col gap-4" data-reveal-lead>
					<PageHeader
						kanji="棚"
						label="Decks"
						title={displayName}
						{...(deck?.description !== null && deck?.description !== undefined && deck.description.length > 0
							? { subtitle: deck.description }
							: {})}
					/>
					<div className="hidden justify-start sm:flex">
						<StudyDeckCta
							href={studyHref}
							disabled={studyDisabled}
							reason={studyDisabledReason}
							size="lg"
						/>
					</div>
				</div>

				{/* ── Snapshot ledger ────────────────────────────────────────
              Full-width rule-bounded stat line. Sits between the header and
              the toolbar so the card list below keeps the entire content
              column — the old sidebar placement narrowed the list.

              Negative top margin neutralises most of the page grid's
              inter-section gap so the ledger sits as close under the Study
              CTA as the CTA sits under the title (a balanced `gap-4` band on
              both sides of the button). */}
				<div className="-mt-4 lg:-mt-6" data-reveal="">
					<DeckSnapshotRibbon deck={deck} loading={false} />
					{isArchived && (
						<p className="mt-4 text-xs text-faded-sumi">
							Archived on this device. It's set aside from your Decks list and daily review queue. Restore it to study again.
						</p>
					)}
				</div>

				{/* ── Cards ──────────────────────────────────────────────────
              Deck-level actions (rename, archive, delete, open in Cards) live
              in the top-bar overflow menu, so this view is just the card list. */}
				<section aria-label="Cards in this deck" className="min-w-0" data-reveal="">
					<DeckCardToolbar
						status={status}
						onStatusChange={next => updateUrlState({ status: next })}
						searchValue={searchValue}
						onSearchChange={next => updateUrlState({ search: next })}
					/>

					{/* Count + sort line. Same control the Cards browser uses, so the
                  count, sort axis, and direction toggle read as one sentence. */}
					{!isCardListEmpty && !cardsError && (
						<div className="mt-4">
							<CardsCountLine
								totalCount={totalMatching}
								sort={sort}
								sortDir={sortDir}
								onPickSort={nextSort => updateUrlState({ sort: nextSort, sortDir: null })}
								onToggleSortDir={() => {
									const natural = naturalSortDirFor(sort);
									const current = sortDir ?? natural;
									const flipped: CardSortDir = current === "asc" ? "desc" : "asc";
									updateUrlState({ sortDir: flipped === natural ? null : flipped });
								}}
							/>
						</div>
					)}

					<div className="mt-4">
						{cardsError
							? (
									<CardListErrorState onRetry={() => void refetch()} />
								)
							: isCardListEmpty
								? (
										<EmptyDeckState deckId={deckId} />
									)
								: filteredEmpty
									? (
											<div className="animate-memory-fade-in">
												<NoMatchState
													searchValue={searchValue}
													selectedStatusLabel={selectedStatusLabel}
													onClearSearch={() => updateUrlState({ search: "" })}
												/>
											</div>
										)
									: (
											<CardsResultsTable
												rows={visibleCards.map(card => apiCardToRow(card, deckId, displayName))}
												onRowAction={(cardId, action) => {
													const card = visibleCards.find(c => c.id === cardId);
													if (card === undefined)
														return;
													handleCardRowAction(action, card);
												}}
												selectedIds={selected}
												onToggleSelection={toggleSelection}
												onToggleAllVisible={toggleAllVisible}
												cardHrefSuffix="?from=decks"
											/>
										)}
					</div>

					{/* Pagination footer — visible whenever there's at least one
                  card to paginate (search runs through the same endpoint
                  now, so paging works the same way with or without it). */}
					{!cardsLoading && !cardsError && cardCount > 0 && (
						<CardListPagination
							pageIndex={pageIndex}
							pageSize={pageSize}
							pageItemCount={visibleCards.length}
							hasPrev={hasPrev}
							hasNext={hasNext}
							isFetchingNext={isCardsFetching && !cardsLoading}
							totalCount={data?.totalCount}
							onPrev={handlePrevPage}
							onNext={handleNextPage}
							onPageSizeChange={handlePageSizeChange}
						/>
					)}
				</section>
			</PageFrame>

			{/* ── Mobile-only sticky Study CTA ───────────────────────────────────
          The header's Study button lives in PageHeader.rightSlot, which is
          hidden below sm. Phones get the primary action here instead so it's
          always reachable while scrolling the card list. Solid paper bar (no
          glass blur), top hairline, safe-area aware. Disabled (rendered
          without a Link) when the deck is empty or archived. Hidden while a
          bulk selection is active so the bulk bar owns the bottom edge. */}
			{selected.size === 0 && (
				<div
					className="fixed inset-x-0 bottom-0 z-[var(--z-bar)] border-t border-soft-hairline bg-cool-paper-base px-4 pt-3 sm:hidden"
					style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
				>
					<StudyDeckCta href={studyHref} disabled={studyDisabled} reason={studyDisabledReason} full />
				</div>
			)}

			{/* ── Bulk-action bar ────────────────────────────────────────────────
          Appears once one or more cards are selected. Sticky to the bottom of
          the app scroll container (the layout <main>), spanning the content
          column. Move / Suspend / Delete mirror the Cards browser; Delete is
          gated behind a confirmation dialog. */}
			{selected.size > 0 && (
				<CardsBulkBar
					selectedCount={selected.size}
					onMove={() => setBulkMoveOpen(true)}
					onSuspend={handleBulkSuspend}
					onDelete={() => setBulkDeleteOpen(true)}
					onClear={clearSelection}
				/>
			)}

			{/* ── Dialogs ────────────────────────────────────────────────────── */}
			<RenameDeckDialog
				open={activeDialog.kind === "rename"}
				deck={deck ?? null}
				currentName={displayName}
				onClose={() => setActiveDialog({ kind: "none" })}
				onLocalRename={(id, name) => nameOverrides.setNameOverride(id, name)}
				onError={msg => showToast(msg)}
				onSuccess={name => showToast(`Renamed to "${truncate(name, 28)}".`)}
			/>

			<DeleteDeckDialog
				open={activeDialog.kind === "delete"}
				deck={deck ?? null}
				cardCount={cardCount}
				onClose={() => setActiveDialog({ kind: "none" })}
				onError={msg => showToast(msg)}
				onSuccess={() => {
					// Deck deletion cascades; clear local rename + archive bits.
					nameOverrides.setNameOverride(deckId, null);
					archiveSet.restore(deckId);
					// Server invalidations + redirect are handled by the dialog's
					// mutation. We just provide a toast for consistency with the rest
					// of the app.
				}}
			/>

			<CardDeleteDialog
				target={activeDialog.kind === "delete-card" ? activeDialog.card : null}
				isDeleting={deleteCardMutation.isPending}
				errorMessage={deleteCardMutation.isError ? (deleteCardMutation.error?.message ?? "Unknown error") : null}
				onCancel={() => setActiveDialog({ kind: "none" })}
				onConfirm={(card) => {
					deleteCardMutation.mutate(card.id, {
						onSuccess: () => {
							setActiveDialog({ kind: "none" });
							showToast("Card deleted.");
						},
					});
				}}
			/>

			<MoveCardDialog
				card={activeDialog.kind === "move-card" ? activeDialog.card : null}
				currentDeckId={deckId}
				variant="move"
				isSubmitting={moveCardMutation.isPending}
				errorMessage={moveCardMutation.isError ? (moveCardMutation.error?.message ?? "Unknown error") : null}
				onCancel={() => {
					setActiveDialog({ kind: "none" });
					moveCardMutation.reset();
				}}
				onConfirm={(card, targetDeckId) => {
					moveCardMutation.mutate(
						{ cardId: card.id, targetDeckId },
						{
							onSuccess: () => {
								setActiveDialog({ kind: "none" });
								showToast("Card moved.");
							},
						},
					);
				}}
			/>

			<MoveCardDialog
				card={activeDialog.kind === "add-card" ? activeDialog.card : null}
				currentDeckId={deckId}
				variant="add"
				isSubmitting={copyCardMutation.isPending}
				errorMessage={copyCardMutation.isError ? (copyCardMutation.error?.message ?? "Unknown error") : null}
				onCancel={() => {
					setActiveDialog({ kind: "none" });
					copyCardMutation.reset();
				}}
				onConfirm={(target, targetDeckId) => {
					copyCardMutation.mutate(
						{ cardId: target.id, targetDeckId },
						{
							onSuccess: () => {
								setActiveDialog({ kind: "none" });
								showToast("Copy added to deck.");
							},
						},
					);
				}}
			/>

			{/* Bulk move — reuses MoveCardDialog with a synthetic "N cards" card.
          Every selected card lives in this deck, so the source is deckId. */}
			<MoveCardDialog
				card={bulkMoveOpen ? bulkMoveSyntheticCard(selected.size) : null}
				currentDeckId={deckId}
				variant="move"
				isSubmitting={bulkMoveMutation.isPending}
				errorMessage={bulkMoveMutation.error?.message ?? null}
				onCancel={() => setBulkMoveOpen(false)}
				onConfirm={handleBulkMoveConfirm}
			/>

			<BulkDeleteCardsDialog
				open={bulkDeleteOpen}
				count={selected.size}
				isSubmitting={bulkDeleteMutation.isPending}
				onCancel={() => setBulkDeleteOpen(false)}
				onConfirm={handleBulkDeleteConfirm}
			/>

			{/* The deleteMutation from this view is kept for backwards-compatibility
          with prior tests / hooks, but the dialog above owns the user flow. */}
			{deleteMutation.isError && null}

			{toast !== null && (
				<Toast
					key={toast.key}
					message={toast.message}
					kind={toast.kind}
					onDismiss={dismissToast}
				/>
			)}
		</>
	);
}
