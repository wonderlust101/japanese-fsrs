"use client";

import type { ApiCardListItem, CardSortDir } from "@fsrs-japanese/shared-types";
import type { CardPageSize } from "./card-list-pagination";
import type { DeckCardsUrlState } from "./deck-cards-url-state";
import type { CardRowAction } from "@/app/(app)/cards/_components/cards-results-table";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "@/app/(app)/_components/page-frame";

import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarActions } from "@/app/(app)/_components/top-bar-actions";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
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

import { copyCardAction, deleteCardAction, listCardsCrossDeckAction, moveCardAction } from "@/lib/actions/cards.actions";
import { deleteDeckAction, getDeckWithStatsAction } from "@/lib/actions/decks.actions";
import {
	useBulkDeleteCardsMutation,
	useBulkMoveCardsMutation,
	useBulkSuspendCardsMutation,
} from "@/lib/api/cards";
import { queryKeys } from "@/lib/api/queryKeys";
import { CardListPagination } from "./card-list-pagination";
import { DeckCardToolbar } from "./deck-card-toolbar";
import { parseDeckCardsUrl, serializeDeckCardsUrl, STATUS_LABEL } from "./deck-cards-url-state";
import { BulkDeleteCardsDialog, CardDeleteDialog } from "./deck-detail-dialogs";
import { CardListErrorState, EmptyDeckState, NoMatchState, StudyDeckCta } from "./deck-detail-states";
import { DeckSnapshotRibbon } from "./deck-snapshot-ribbon";
import { MoveCardDialog } from "./move-card-dialog";

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

const DEFAULT_PAGE_SIZE: CardPageSize = 25;

// ─── Component ────────────────────────────────────────────────────────────────

export function DeckDetailView({ deckId, deckName }: Props): React.JSX.Element {
	useDeckDetailDevState();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();

	// Local archive + name override state (shared with Decks page via localStorage).
	const archiveSet = useArchiveSet();
	const nameOverrides = useLocalNameOverrides();
	const isArchived = archiveSet.isArchived(deckId);
	const displayName = nameOverrides.nameFor(deckId, deckName);

	// ── URL-canonical filter state ───────────────────────────────────────
	// status / search / page live in the URL so the filtered view is
	// deep-linkable and survives reload. Mirrors cards-browser-view: the URL
	// is the single source of truth (derived via useMemo), not a duplicated
	// useState that would race router.replace. `pageSize` stays local — it's a
	// viewing preference, not part of the view definition.
	const urlState = useMemo(() => parseDeckCardsUrl(k => searchParams.get(k)), [searchParams]);
	const status = urlState.status;
	const searchValue = urlState.search;
	const sort = urlState.sort;
	const sortDir = urlState.sortDir;
	const pageIndex = urlState.page - 1; // 0-indexed for internal use

	const [pageSize, setPageSize] = useState<CardPageSize>(DEFAULT_PAGE_SIZE);
	const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: "none" });
	// Bulk-select state for mass editing. Tracked by card id, local (never in the
	// URL). Cleared whenever the result set itself changes (below); flipping pages
	// keeps the selection since it's id-based, not row-position based.
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
	const { toast, showToast, dismissToast } = useToast();

	// Single writer for the URL state. Accepts a partial patch merged onto the
	// current state. Resets to page 1 whenever a field that changes the result
	// set or its order (status / search / sort) changes, so the user never lands
	// on a stale page; page-only navigation passes through unchanged.
	function updateUrlState(patch: Partial<DeckCardsUrlState>): void {
		const current: DeckCardsUrlState = { status, search: searchValue, sort, sortDir, page: pageIndex + 1 };
		const next = { ...current, ...patch };
		const onlyPageChanged
			= next.status === current.status && next.search === current.search
				&& next.sort === current.sort && next.sortDir === current.sortDir;
		const finalNext = onlyPageChanged ? next : { ...next, page: 1 };
		const qs = serializeDeckCardsUrl(finalNext).toString();
		router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	// Deck header stats.
	const { data: deck, isLoading: deckLoading } = useQuery({
		queryKey: queryKeys.decks.detail(deckId),
		queryFn: () => getDeckWithStatsAction(deckId),
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

	const visibleCards = data?.items ?? [];

	// Pagination affordance state.
	const hasPrev = pageIndex > 0;
	const hasNext = (data?.hasMore ?? false) === true;

	const cardCount = deck?.cardCount ?? 0;
	const totalMatching = data?.totalCount ?? visibleCards.length;
	const isCardListEmpty = !cardsLoading && cardCount === 0;
	const filteredEmpty = !cardsLoading && cardCount > 0 && visibleCards.length === 0;
	const selectedStatusLabel = STATUS_LABEL[status];

	// ── Bulk selection ────────────────────────────────────────────────────
	const visibleIds = useMemo(() => visibleCards.map(c => c.id), [visibleCards]);

	// Drop the selection whenever the result set itself changes (filter / search
	// / sort / page size). Page navigation is intentionally excluded: selection
	// is id-keyed, so paging keeps prior picks. Mirrors cards-browser-view.
	useEffect(() => {
		setSelected(new Set());
	}, [status, trimmedSearch, sort, sortDir, pageSize]);

	function toggleSelection(id: string): void {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id))
				next.delete(id); else next.add(id);
			return next;
		});
	}
	function toggleAllVisible(): void {
		setSelected((prev) => {
			const allChecked = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
			const next = new Set(prev);
			for (const id of visibleIds) {
				if (allChecked)
					next.delete(id); else next.add(id);
			}
			return next;
		});
	}
	function clearSelection(): void { setSelected(new Set()); }

	// ── Bulk mutations (shared hooks; invalidate cards.* + decks.*) ────────
	const bulkMoveMutation = useBulkMoveCardsMutation();
	const bulkSuspendMutation = useBulkSuspendCardsMutation();
	const bulkDeleteMutation = useBulkDeleteCardsMutation();
	const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

	function reportBulkResult(label: string, result: { succeeded: readonly string[]; failed: readonly { id: string; error: string }[] }): void {
		const ok = result.succeeded.length;
		const no = result.failed.length;
		if (no === 0)
			showToast(`${label}: ${ok} ${ok === 1 ? "card" : "cards"} updated.`);
		else showToast(`${label}: ${ok} updated, ${no} failed.`, "error");
	}

	function handleBulkMoveConfirm(_card: ApiCardListItem, targetDeckId: string): void {
		bulkMoveMutation.mutate({ ids: [...selected], targetDeckId }, {
			onSuccess: (result) => { reportBulkResult("Move", result); clearSelection(); setBulkMoveOpen(false); },
			onError: () => showToast("Couldn't move those cards. Please try again.", "error"),
		});
	}
	function handleBulkSuspend(): void {
		bulkSuspendMutation.mutate([...selected], {
			onSuccess: (result) => { reportBulkResult("Suspend", result); clearSelection(); },
			onError: () => showToast("Couldn't suspend those cards. Please try again.", "error"),
		});
	}
	function handleBulkDeleteConfirm(): void {
		bulkDeleteMutation.mutate([...selected], {
			onSuccess: (result) => { reportBulkResult("Delete", result); clearSelection(); setBulkDeleteOpen(false); },
			onError: () => showToast("Couldn't delete those cards. Please try again.", "error"),
		});
	}

	// ── Card-delete mutation ──────────────────────────────────────────────
	const deleteCardMutation = useMutation({
		mutationFn: (cardId: string) => deleteCardAction(cardId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
		},
	});

	// ── Card-move mutation ────────────────────────────────────────────────
	const moveCardMutation = useMutation({
		mutationFn: ({ cardId, targetDeckId }: { cardId: string; targetDeckId: string }) =>
			moveCardAction(cardId, targetDeckId),
		onSuccess: (_data, { targetDeckId }) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(targetDeckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
		},
	});

	// ── Card-copy mutation ────────────────────────────────────────────────
	// Cloning leaves the source card untouched, so this mutation only refreshes
	// the target deck's caches plus the shared decks list and review queue (the
	// copy lands in state=0 and is due immediately).
	const copyCardMutation = useMutation({
		mutationFn: ({ cardId, targetDeckId }: { cardId: string; targetDeckId: string }) =>
			copyCardAction(cardId, targetDeckId),
		onSuccess: (_data, { targetDeckId }) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(targetDeckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(targetDeckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
		},
	});

	function handlePageSizeChange(next: CardPageSize): void {
		setPageSize(next);
		// Changing page size changes how the result set paginates, so jump back
		// to page 1 (pageSize itself is local, not a URL param).
		updateUrlState({ page: 1 });
	}

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

	// ── Render ────────────────────────────────────────────────────────────
	const studyHref = `/review/setup?deck=${encodeURIComponent(deckId)}`;
	// Study is unavailable when the deck has no cards, or when it's archived
	// (archive sets the deck aside; you restore it before studying again).
	const studyDisabled = isCardListEmpty || isArchived;
	const studyDisabledReason = isArchived
		? "Restore this deck to study it."
		: "Add a card to study this deck.";

	if (deckLoading || cardsLoading) {
		return (
			<>
				<TopBar>
					<TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
					<TopBarTitle kanji="束" label={displayName} />
				</TopBar>
				<PageLoader />
			</>
		);
	}

	return (
		<>
			<TopBar>
				<TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
				<TopBarTitle kanji="束" label={displayName} />

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
			</TopBar>

			<PageFrame>

				{/* ── Page hero + primary action ─────────────────────────────
              Header and the Study CTA are grouped into one grid child with a
              tight internal gap, so the page's larger inter-section rhythm
              only opens up *around* the pair — the button sits close under
              the title instead of floating in a full grid gap. The CTA is
              left-aligned on the reading edge and desktop-only (phones use the
              sticky bottom bar). */}
				<div className="flex flex-col gap-4">
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
				<div className="-mt-4 lg:-mt-6">
					<DeckSnapshotRibbon deck={deck} loading={deckLoading} />
					{isArchived && (
						<p className="mt-4 text-xs text-faded-sumi">
							Archived on this device. It's set aside from your Decks list and daily review queue. Restore it to study again.
						</p>
					)}
				</div>

				{/* ── Cards ──────────────────────────────────────────────────
              Deck-level actions (rename, archive, delete, open in Cards) live
              in the top-bar overflow menu, so this view is just the card list. */}
				<section aria-label="Cards in this deck" className="min-w-0">
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
											<NoMatchState
												searchValue={searchValue}
												selectedStatusLabel={selectedStatusLabel}
												onClearSearch={() => updateUrlState({ search: "" })}
											/>
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
