import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPremadeDeckCached } from "@/lib/data/route-reads";

import { PremadePreviewView } from "./_components/premade-preview-view";

interface PageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { id } = await params;
	const deck = await getPremadeDeckCached(id);
	return { title: deck === null ? "Deck preview" : `Preview · ${deck.name}` };
}

export default async function PremadeDeckPreviewPage({ params }: PageProps): Promise<React.JSX.Element> {
	const { id } = await params;
	const deck = await getPremadeDeckCached(id);
	if (deck === null)
		notFound();

	return (
		<PremadePreviewView
			premadeDeckId={id}
			deckName={deck.name}
			description={deck.description}
			cardCount={deck.cardCount}
		/>
	);
}
