"use client";

import type { CardPageSize } from "../../_components/card-list-pagination";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { apiCardToRow } from "@/app/(app)/cards/_components/cards-card-rows";
import { CardsResultsTable } from "@/app/(app)/cards/_components/cards-results-table";
import { Button } from "@/components/ui/Button";
import { PAGE_HEADER_PADDING, PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Toast, useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useDeckPreviewDevState } from "@/dev/panels/deck-preview";
import { listCardsCrossDeckAction } from "@/lib/actions/cards.actions";
import { getDeckWithStatsAction } from "@/lib/actions/decks.actions";
import { useCopyPremadeDeck } from "@/lib/api/premade";

import { queryKeys } from "@/lib/api/queryKeys";
import {
	CardListPagination,

} from "../../_components/card-list-pagination";

const DEFAULT_PAGE_SIZE: CardPageSize = 25;

interface Props {
	deckId: string;
	deckName: string;
}

/**
 * Deck preview surface. Reuses the regular deck-detail chrome — PageHeader,
 * search, CardsResultsTable, pagination — but strips every surface that
 * exposes personal stats or editing: the TopBar kebab, the "Study deck" CTA,
 * per-row kebab, FSRS status pill, due date, snapshot aside, and Options
 * panel. The single deck-level action is "Add to my library", which copies
 * the underlying premade source so the learner ends up with a fresh deck
 * to study from.
 *
 * Reached via the premade catalogue's "View deck" action for any premade
 * entry the user has already copied. Routed at `/decks/[id]/preview`.
 */
export function DeckPreviewView({ deckId, deckName }: Props): React.JSX.Element {
	useDeckPreviewDevState();
	const router = useRouter();
	const { toast, showToast, dismissToast } = useToast();
	const copyMutation = useCopyPremadeDeck();

	const [searchValue, setSearchValue] = useState("");
	const [pageSize, setPageSize] = useState<CardPageSize>(DEFAULT_PAGE_SIZE);
	const [pageIndex, setPageIndex] = useState(0);

	// Deck metadata. Drives the attribution chip and the empty/error states.
	// Reused query key so a fresh detail-page fetch hydrates this view too.
	const { data: deck } = useQuery({
		queryKey: queryKeys.decks.detail(deckId),
		queryFn: () => getDeckWithStatsAction(deckId),
	});

	// Card list — pulls from the cross-deck endpoint with `deckId` as the
	// scope filter so the search input becomes a real backend search.
	// Status filter intentionally omitted — read-only mode doesn't expose
	// the FSRS status pill, so a filter on it would be confusing. Key
	// intentionally distinct from the deck-detail page's so a search-
	// filtered cache there doesn't accidentally satisfy this query.
	const trimmedSearch = searchValue.trim();
	const {
		data,
		refetch,
		isFetching: isCardsFetching,
		isLoading: cardsLoading,
		isError: cardsError,
	} = useQuery({
		queryKey: [...queryKeys.cards.byDeck(deckId), "preview", pageSize, trimmedSearch, pageIndex],
		queryFn: () => listCardsCrossDeckAction({
			deckId,
			limit: pageSize,
			...(pageIndex > 0 ? { offset: pageIndex * pageSize } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
		}),
		placeholderData: keepPreviousData,
	});

	const searchActive = trimmedSearch.length > 0;
	const visibleCards = data?.items ?? [];

	const hasPrev = pageIndex > 0;
	const hasNext = (data?.hasMore ?? false) === true;
	const cardCount = deck?.cardCount ?? 0;
	const isCardListEmpty = !cardsLoading && cardCount === 0;
	const filteredEmpty = !cardsLoading && cardCount > 0 && visibleCards.length === 0;
	const sourcePremadeId = deck?.sourcePremadeId ?? null;

	function handleNextPage(): void {
		if (hasNext && !isCardsFetching) {
			setPageIndex(i => i + 1);
		}
	}

	function handlePrevPage(): void {
		setPageIndex(i => Math.max(0, i - 1));
	}

	// Adds another copy of the underlying premade source, mirroring the
	// catalogue's "Add another copy" affordance. The CTA only renders when
	// `sourcePremadeId !== null` (see rightSlot below), so the mutation has a
	// real id to work with; the guard here is defensive against stale clicks
	// after the deck row is unloaded.
	function handleAddToLibrary(): void {
		if (sourcePremadeId === null || copyMutation.isPending)
			return;
		copyMutation.mutate(sourcePremadeId, {
			onSuccess: (result) => {
				showToast(
					`Added ${result.cardCount} ${result.cardCount === 1 ? "card" : "cards"} to your library.`,
				);
				router.push(`/decks/${result.deckId}/preview`);
			},
			onError: () => {
				showToast(
					"Couldn't add this deck. Please try again in a moment.",
					"error",
				);
			},
		});
	}

	if (cardsLoading) {
		return (
			<>
				<TopBar>
					<TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
				</TopBar>
				<PageLoader />
			</>
		);
	}

	return (
		<>
			<TopBar>
				<TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
				<TopBarTitle kanji="棚" label={deckName} />
			</TopBar>

			<div className="min-h-screen bg-cool-paper-base pb-32">
				<div className="mx-auto max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16">
					<div className={PAGE_HEADER_PADDING}>
						<PageHeader
							kanji="棚"
							label="Deck preview"
							title={deckName}
							{...(deck?.description !== null && deck?.description !== undefined && deck.description.length > 0
								? { subtitle: deck.description }
								: {})}
							rightSlot={
								sourcePremadeId !== null
									? (
											<Button
												type="button"
												size="sm"
												variant="primary"
												onClick={handleAddToLibrary}
												loading={copyMutation.isPending}
												aria-label={`Add ${deckName} to your library`}
											>
												Add to my library
											</Button>
										)
									: undefined
							}
						/>
					</div>

					<div className="flex flex-col gap-y-6">
						<section aria-label="Cards in this deck" className="min-w-0">
							<SearchOnlyToolbar
								value={searchValue}
								onChange={setSearchValue}
							/>

							<div className="mt-4">
								{cardsError
									? (
											<PreviewMessage
												title="Couldn't load this deck's cards."
												body="The list tried to read from the server and didn't get a reply. Try again in a moment."
												action={(
													<Button size="sm" variant="secondary" onClick={() => void refetch()}>
														Try again
													</Button>
												)}
											/>
										)
									: isCardListEmpty
										? (
												<PreviewMessage
													title="This deck has no cards yet."
													body="Cards added to the source deck will appear here."
												/>
											)
										: filteredEmpty
											? (
													<PreviewMessage
														title={searchActive
															? `No cards match '${searchValue}'.`
															: "No cards to show."}
														body={searchActive
															? "Try a different search term, or clear the search."
															: "Try loading more cards."}
														action={searchActive
															? (
																	<Button size="sm" variant="secondary" onClick={() => setSearchValue("")}>
																		Clear search
																	</Button>
																)
															: undefined}
													/>
												)
											: (
													<CardsResultsTable
														rows={visibleCards.map(card => apiCardToRow(card, deckId, deckName))}
														loading={cardsLoading}
														readOnly
														cardHrefSuffix="?from=preview"
													/>
												)}
							</div>

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
									onPageSizeChange={(next) => {
										setPageSize(next);
										setPageIndex(0);
									}}
								/>
							)}
						</section>
					</div>
				</div>
			</div>

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

// ─── Subcomponents ───────────────────────────────────────────────────────

interface SearchOnlyToolbarProps {
	value: string;
	onChange: (next: string) => void;
}

/**
 * Search-only toolbar — the deck-detail page's status-filter pills are
 * suppressed in read-only mode because the FSRS status pill they map to
 * doesn't render here. Keeps the affordance the user expects (filter
 * the loaded cards by word/meaning/reading) without exposing personal
 * state dimensions.
 */
function SearchOnlyToolbar({
	value,
	onChange,
}: SearchOnlyToolbarProps): React.JSX.Element {
	return (
		<section
			aria-label="Card filters"
			className="flex flex-col gap-3 border-b border-soft-hairline pb-4 sm:flex-row sm:items-center sm:justify-end"
		>
			<div className="w-full sm:max-w-[20rem]">
				<SearchInput
					value={value}
					onChange={onChange}
					placeholder="Search this deck"
					ariaLabel="Search this deck by word, reading, or meaning"
				/>
			</div>
		</section>
	);
}

interface PreviewMessageProps {
	title: string;
	body: string;
	action?: React.ReactNode;
}

function PreviewMessage({ title, body, action }: PreviewMessageProps): React.JSX.Element {
	return (
		<div
			role="status"
			className="rounded-xs border border-soft-hairline bg-cream-inset/45 p-6 text-center sm:p-8"
		>
			<p className="text-sm font-medium text-sumi-ink">{title}</p>
			<p className="mx-auto mt-1.5 max-w-measure-tight text-sm text-faded-sumi">{body}</p>
			{action !== undefined && <div className="mt-4">{action}</div>}
		</div>
	);
}
