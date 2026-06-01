"use client";

import type { CardSortDir, CardSortField } from "@fsrs-japanese/shared-types";
import type { CardPageSize } from "../../_components/card-list-pagination";

import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { apiCardToRow } from "@/app/(app)/cards/_components/cards-card-rows";
import { CardsCountLine } from "@/app/(app)/cards/_components/cards-count-line";
import { naturalSortDirFor } from "@/app/(app)/cards/_components/cards-filter-state";
import { CardsResultsTable } from "@/app/(app)/cards/_components/cards-results-table";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PAGE_HEADER_PADDING, PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useDeckPreviewDevState } from "@/dev/panels/deck-preview";
import { useRevealMount } from "@/hooks/use-reveal-mount";
import { listCardsCrossDeckAction } from "@/lib/actions/cards.actions";
import { getDeckWithStatsAction } from "@/lib/actions/decks.actions";
import { queryKeys } from "@/lib/api/queryKeys";
import { CardListPagination } from "../../_components/card-list-pagination";

const DEFAULT_PAGE_SIZE: CardPageSize = 25;

interface Props {
	deckId: string;
	deckName: string;
}

/**
 * Read-only preview of a premade deck the user *has* copied, reached from the
 * premade catalogue's "View deck" action and routed at `/decks/[id]/preview`.
 *
 * Deliberately a mirror image of the not-yet-copied preview
 * (`PremadePreviewView` at `/decks/premade/[id]`): identical chrome — the same
 * search toolbar, `CardsCountLine` (sort), `CardsResultsTable` (Word / Meaning
 * / Type — Status column and row links both suppressed, exactly like the
 * uncopied preview), `CardListPagination` footer, and the deck-detail CTA
 * placement (left-aligned primary on desktop, sticky bottom bar on phones).
 * The *only* intended difference is the CTA: where the uncopied preview offers
 * "Add to my library", this one — the deck already lives in the library —
 * offers "View deck", linking to the owned deck-detail page to study from.
 *
 * It sources cards from the cross-deck listing scoped to `deckId` (the owned
 * copy), so the search input is a real backend search.
 */
export function DeckPreviewView({ deckId, deckName }: Props): React.JSX.Element {
	useDeckPreviewDevState();

	const [searchValue, setSearchValue] = useState("");
	const [sort, setSort] = useState<CardSortField>("recent");
	const [sortDir, setSortDir] = useState<CardSortDir | null>(null);
	const [pageSize, setPageSize] = useState<CardPageSize>(DEFAULT_PAGE_SIZE);
	const [pageIndex, setPageIndex] = useState(0);

	// Deck metadata. Drives the header subtitle and the empty/error states.
	// Reused query key so a fresh detail-page fetch hydrates this view too.
	// `gcTime: 0` evicts on unmount so navigation back fetches fresh data.
	const { data: deck } = useSuspenseQuery({
		queryKey: queryKeys.decks.detail(deckId),
		queryFn: () => getDeckWithStatsAction(deckId),
		gcTime: 0,
	});

	// Card list — pulls from the cross-deck endpoint with `deckId` as the
	// scope filter so the search input becomes a real backend search. Key
	// intentionally distinct from the deck-detail page's so a search-filtered
	// cache there doesn't accidentally satisfy this query.
	const trimmedSearch = searchValue.trim();
	const {
		data,
		refetch,
		isFetching: isCardsFetching,
		isLoading: cardsLoading,
		isError: cardsError,
	} = useQuery({
		queryKey: [...queryKeys.cards.byDeck(deckId), "preview", pageSize, trimmedSearch, sort, sortDir, pageIndex],
		queryFn: () => listCardsCrossDeckAction({
			deckId,
			limit: pageSize,
			sort,
			...(sortDir !== null ? { sortDir } : {}),
			...(pageIndex > 0 ? { offset: pageIndex * pageSize } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
		}),
		placeholderData: keepPreviousData,
	});

	const visibleCards = data?.items ?? [];
	const totalMatching = data?.totalCount ?? 0;
	const hasPrev = pageIndex > 0;
	const hasNext = (data?.hasMore ?? false) === true;

	// `deck.cardCount` is the *unfiltered* deck size, so an empty result with
	// cards in the deck means the filter/search narrowed to zero — distinct
	// from a genuinely empty deck.
	const cardCount = deck?.cardCount ?? 0;
	const isDeckEmpty = !cardsLoading && cardCount === 0;
	const filteredEmpty = !cardsLoading && cardCount > 0 && visibleCards.length === 0;
	const searchActive = trimmedSearch.length > 0;

	// Any filter/sort change invalidates the current offset, so jump back to
	// page 1 rather than stranding the user past the new last page.
	function resetToFirstPage(): void {
		setPageIndex(0);
	}

	function handleNextPage(): void {
		if (hasNext && !isCardsFetching)
			setPageIndex(i => i + 1);
	}

	function handlePrevPage(): void {
		setPageIndex(i => Math.max(0, i - 1));
	}

	// Page-level reveal — header chrome only (mount, single lead beat). The
	// preview card LIST stays static (spec §P2.6: list rows never revealed).
	// Re-runs once the loaded view (vs loader) mounts.
	const contentRef = useRef<HTMLDivElement | null>(null);
	useRevealMount(contentRef, { deps: [cardsLoading] });

	if (cardsLoading) {
		return (
			<>
				<TopBar>
					<TopBarBackLink href="/decks/premade" ariaLabel="Back to Premade decks" />
				</TopBar>
				<PageLoader />
			</>
		);
	}

	return (
		<>
			<TopBar>
				<TopBarBackLink href="/decks/premade" ariaLabel="Back to Premade decks" />
				<TopBarTitle kanji="集" label={deckName} />
			</TopBar>

			<div className="min-h-screen bg-cool-paper-base pb-32">
				<div ref={contentRef} className="mx-auto max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16">
					{/* ── Page hero + primary action ──────────────────────────────
              Header and the View CTA are grouped with a tight internal gap so
              the button sits close under the title. The CTA is left-aligned
              and desktop-only (phones use the sticky bottom bar below), exactly
              like the deck-detail Study CTA and the uncopied premade preview. */}
					<div className={PAGE_HEADER_PADDING}>
						<div className="flex flex-col gap-4" data-reveal-lead>
							<PageHeader
								kanji="集"
								label="Deck preview · premade"
								title={deckName}
								{...(deck?.description != null && deck.description.length > 0
									? { subtitle: deck.description }
									: {})}
							/>
							<div className="hidden justify-start sm:flex">
								<ViewDeckCta deckId={deckId} deckName={deckName} size="lg" />
							</div>
						</div>
					</div>

					<section aria-label="Cards in this deck" className="min-w-0">
						<SearchOnlyToolbar
							value={searchValue}
							onChange={(next) => { setSearchValue(next); resetToFirstPage(); }}
						/>

						{/* Count + sort line — the same control the Cards browser, Deck
                Detail, and the uncopied premade preview use, so count, sort
                axis, and direction read as one sentence. */}
						{!isDeckEmpty && !cardsError && (
							<div className="mt-4">
								<CardsCountLine
									totalCount={totalMatching}
									sort={sort}
									sortDir={sortDir}
									onPickSort={(nextSort) => { setSort(nextSort); setSortDir(null); resetToFirstPage(); }}
									onToggleSortDir={() => {
										const natural = naturalSortDirFor(sort);
										const current = sortDir ?? natural;
										const flipped: CardSortDir = current === "asc" ? "desc" : "asc";
										setSortDir(flipped === natural ? null : flipped);
										resetToFirstPage();
									}}
								/>
							</div>
						)}

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
								: isDeckEmpty
									? (
											<PreviewMessage
												title="This deck has no cards yet."
												body="Cards in this deck will appear here."
											/>
										)
									: filteredEmpty
										? (
												<PreviewMessage
													title={searchActive ? `No cards match '${searchValue}'.` : "No cards to show."}
													body={searchActive
														? "Try a different search term, or clear the search."
														: "Try loading more cards."}
													action={searchActive
														? (
																<Button
																	size="sm"
																	variant="secondary"
																	onClick={() => { setSearchValue(""); resetToFirstPage(); }}
																>
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
													readOnly={false}
													showActions={false}
													showStatusColumn={false}
													linkRows={false}
												/>
											)}
						</div>

						{!cardsLoading && !cardsError && !isDeckEmpty && (
							<CardListPagination
								pageIndex={pageIndex}
								pageSize={pageSize}
								pageItemCount={visibleCards.length}
								hasPrev={hasPrev}
								hasNext={hasNext}
								isFetchingNext={isCardsFetching && !cardsLoading}
								totalCount={totalMatching}
								onPrev={handlePrevPage}
								onNext={handleNextPage}
								onPageSizeChange={(next) => {
									setPageSize(next);
									resetToFirstPage();
								}}
							/>
						)}
					</section>
				</div>
			</div>

			{/* ── Mobile-only sticky View CTA ──────────────────────────────────
          The header's View button is desktop-only; phones get the primary
          action pinned to the bottom edge so it's always reachable while
          scrolling the card list. Mirrors the deck-detail sticky Study bar and
          the uncopied premade preview's sticky Add bar. */}
			<div
				className="fixed inset-x-0 bottom-0 z-[var(--z-bar)] border-t border-soft-hairline bg-cool-paper-base px-4 pt-3 sm:hidden"
				style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
			>
				<ViewDeckCta deckId={deckId} deckName={deckName} full />
			</div>
		</>
	);
}

// ─── View-deck CTA ───────────────────────────────────────────────────────────

interface ViewDeckCtaProps {
	deckId: string;
	deckName: string;
	size?: "md" | "lg";
	full?: boolean;
}

/**
 * The copied-deck preview's primary action, standing in for the uncopied
 * preview's "Add to my library". The deck already lives in the user's library,
 * so this navigates to the owned deck-detail page to study from.
 */
function ViewDeckCta({ deckId, deckName, size = "md", full = false }: ViewDeckCtaProps): React.JSX.Element {
	return (
		<ButtonLink
			href={`/decks/${deckId}`}
			variant="primary"
			size={size}
			aria-label={`View ${deckName} in deck`}
			className={full ? "w-full" : ""}
		>
			View in deck
		</ButtonLink>
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
export function SearchOnlyToolbar({
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

export function PreviewMessage({ title, body, action }: PreviewMessageProps): React.JSX.Element {
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
