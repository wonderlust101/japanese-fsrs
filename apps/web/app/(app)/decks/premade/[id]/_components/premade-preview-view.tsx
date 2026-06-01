"use client";

import type { CardSortDir, CardSortField } from "@fsrs-japanese/shared-types";
import type { CardPageSize } from "@/app/(app)/decks/[id]/_components/card-list-pagination";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { apiCardToRow } from "@/app/(app)/cards/_components/cards-card-rows";
import { CardsCountLine } from "@/app/(app)/cards/_components/cards-count-line";
import { naturalSortDirFor } from "@/app/(app)/cards/_components/cards-filter-state";
import { CardsResultsTable } from "@/app/(app)/cards/_components/cards-results-table";
import { CardListPagination } from "@/app/(app)/decks/[id]/_components/card-list-pagination";
import { PreviewMessage, SearchOnlyToolbar } from "@/app/(app)/decks/[id]/preview/_components/deck-preview-view";
import { Button } from "@/components/ui/Button";
import { PAGE_HEADER_PADDING, PageHeader } from "@/components/ui/PageHeader";
import { Toast, useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useRevealMount } from "@/hooks/use-reveal-mount";
import { listPremadeDeckCardsAction } from "@/lib/actions/premade.actions";
import { useCopyPremadeDeck } from "@/lib/api/premade";
import { queryKeys } from "@/lib/api/queryKeys";

const DEFAULT_PAGE_SIZE: CardPageSize = 25;

interface Props {
	premadeDeckId: string;
	deckName: string;
	description: string | null;
	cardCount: number;
}

/**
 * Read-only preview of a premade deck the user has *not* copied yet. Reached
 * from the premade catalogue, routed at `/decks/premade/[id]`.
 *
 * Mirrors the deck-detail surface — a search toolbar and `CardsCountLine`
 * (sort), the `CardsResultsTable` (Word / Meaning / Type / Due), the
 * `CardListPagination` footer, and the deck-detail CTA placement (left-aligned
 * primary on desktop, sticky bottom bar on phones). The FSRS status filter and
 * the Status column are both omitted (`showStatusColumn={false}`) — every
 * source card is pristine ("New"), so they'd carry no signal. It sources cards
 * from the premade endpoints (source cards live under `premade_deck_id`,
 * unreachable by the cross-deck listing), suppresses every mutation — row
 * actions off (`showActions={false}`) and rows non-linking (`linkRows={false}`,
 * unowned cards have no detail page) — and swaps "Study deck" for "Add to my
 * library", which copies this premade deck and routes to the owned-deck preview.
 */
export function PremadePreviewView({ premadeDeckId, deckName, description, cardCount }: Props): React.JSX.Element {
	const router = useRouter();
	const { toast, showToast, dismissToast } = useToast();
	const copyMutation = useCopyPremadeDeck();

	const [searchValue, setSearchValue] = useState("");
	const [sort, setSort] = useState<CardSortField>("recent");
	const [sortDir, setSortDir] = useState<CardSortDir | null>(null);
	const [pageSize, setPageSize] = useState<CardPageSize>(DEFAULT_PAGE_SIZE);
	const [pageIndex, setPageIndex] = useState(0);

	const trimmedSearch = searchValue.trim();
	const {
		data,
		isLoading: cardsLoading,
		isError: cardsError,
		refetch,
		isFetching: isCardsFetching,
	} = useQuery({
		queryKey: [
			...queryKeys.premadeDecks.list(),
			premadeDeckId,
			"cards",
			pageSize,
			trimmedSearch,
			sort,
			sortDir,
			pageIndex,
		],
		queryFn: () => listPremadeDeckCardsAction(premadeDeckId, {
			limit: pageSize,
			sort,
			sortDir,
			...(pageIndex > 0 ? { offset: pageIndex * pageSize } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
		}),
		placeholderData: keepPreviousData,
	});

	const visibleCards = data?.items ?? [];
	const totalMatching = data?.totalCount ?? 0;
	const hasPrev = pageIndex > 0;
	const hasNext = (data?.hasMore ?? false) === true;

	// Page-level reveal — header lead + cards section as the second beat.
	// Fires once when the card list finishes its initial load (the loading-branch
	// early return skips the contentRef div, so the ref is null until the loaded
	// shell mounts and the dep flips from false to true). Mirrors the catalogue's
	// mount-mode pattern; no ScrollTrigger needed for this above-fold surface.
	const contentRef = useRef<HTMLDivElement | null>(null);
	useRevealMount(contentRef, { deps: [!cardsLoading] });

	// `cardCount` (from deck metadata) is the *unfiltered* size, so an empty
	// result with cards in the deck means the filter/search narrowed to zero —
	// distinct from a genuinely empty deck.
	const isDeckEmpty = cardCount === 0;
	const filteredEmpty = !cardsLoading && !isDeckEmpty && visibleCards.length === 0;
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

	function handleAddToLibrary(): void {
		if (copyMutation.isPending)
			return;
		copyMutation.mutate(premadeDeckId, {
			onSuccess: (result) => {
				showToast(
					`Added ${result.cardCount} ${result.cardCount === 1 ? "card" : "cards"} to your library.`,
				);
				router.push(`/decks/${result.deckId}/preview`);
			},
			onError: () => {
				showToast("Couldn't add this deck. Please try again in a moment.", "error");
			},
		});
	}

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
              Header and the Add CTA are grouped with a tight internal gap so
              the button sits close under the title. The CTA is left-aligned
              and desktop-only (phones use the sticky bottom bar below), exactly
              like the deck-detail Study CTA. */}
					<div className={PAGE_HEADER_PADDING}>
						<div className="flex flex-col gap-4">
							<PageHeader
								kanji="集"
								label="Deck preview · premade"
								title={deckName}
								{...(description !== null && description.length > 0 ? { subtitle: description } : {})}
								revealLead
							/>
							<div className="hidden justify-start sm:flex">
								<AddToLibraryCta
									onClick={handleAddToLibrary}
									loading={copyMutation.isPending}
									deckName={deckName}
									size="lg"
								/>
							</div>
						</div>
					</div>

					<section aria-label="Cards in this deck" className="min-w-0" data-reveal="">
						<SearchOnlyToolbar
							value={searchValue}
							onChange={(next) => { setSearchValue(next); resetToFirstPage(); }}
						/>

						{/* Count + sort line — the same control the Cards browser and
                Deck Detail use, so count, sort axis, and direction read as
                one sentence. */}
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
												body="Tomo is still curating this deck. Check back soon."
											/>
										)
									: filteredEmpty
										? (
												<div className="animate-memory-fade-in">
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
												</div>
											)
										: (
												<CardsResultsTable
													rows={visibleCards.map(card => apiCardToRow(card, premadeDeckId, deckName))}
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

			{/* ── Mobile-only sticky Add CTA ───────────────────────────────────
          The header's Add button is desktop-only; phones get the primary
          action pinned to the bottom edge so it's always reachable while
          scrolling the card list. Mirrors the deck-detail sticky Study bar. */}
			<div
				className="fixed inset-x-0 bottom-0 z-[var(--z-bar)] border-t border-soft-hairline bg-cool-paper-base px-4 pt-3 sm:hidden"
				style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
			>
				<AddToLibraryCta
					onClick={handleAddToLibrary}
					loading={copyMutation.isPending}
					deckName={deckName}
					full
				/>
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

// ─── Add-to-library CTA ──────────────────────────────────────────────────────

interface AddToLibraryCtaProps {
	onClick: () => void;
	loading: boolean;
	deckName: string;
	size?: "md" | "lg";
	full?: boolean;
}

/**
 * The premade preview's primary action, standing in for the deck-detail Study
 * CTA. Copies this premade deck into the user's library.
 */
function AddToLibraryCta({ onClick, loading, deckName, size = "md", full = false }: AddToLibraryCtaProps): React.JSX.Element {
	return (
		<Button
			type="button"
			variant="primary"
			size={size}
			onClick={onClick}
			loading={loading}
			aria-label={`Add ${deckName} to your library`}
			className={full ? "w-full" : undefined}
		>
			Add to my library
		</Button>
	);
}
