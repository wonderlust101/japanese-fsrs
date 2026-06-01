import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { listCardsCrossDeckAction } from "@/lib/actions/cards.actions";
import { queryKeys } from "@/lib/api/queryKeys";
import { getDeckCached } from "@/lib/data/route-reads";

import { DeckDetailView } from "./_components/deck-detail-view";

interface Props {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	const deck = await getDeckCached(id);
	return { title: deck?.name ?? "Deck" };
}

export default async function DeckDetailPage({ params }: Props): Promise<React.JSX.Element> {
	const { id: deckId } = await params;
	const deck = await getDeckCached(deckId);
	if (deck === null)
		notFound();

	const queryClient = new QueryClient();

	// Seed the deck header (useSuspenseQuery in DeckDetailView uses this key)
	// and the first page of cards so neither suspends or shows a second loader.
	// Cards key mirrors the defaults in use-deck-cards-url-state: status="all",
	// pageSize=25, search="", sort="recent", sortDir=null, pageIndex=0.
	queryClient.setQueryData(queryKeys.decks.detail(deckId), deck);
	await queryClient.prefetchQuery({
		queryKey: [...queryKeys.cards.byDeck(deckId), "all", 25, "", "recent", null, 0],
		queryFn: () => listCardsCrossDeckAction({ deckId, limit: 25, sort: "recent" }),
	});

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<DeckDetailView deckId={deckId} deckName={deck.name} />
		</HydrationBoundary>
	);
}
