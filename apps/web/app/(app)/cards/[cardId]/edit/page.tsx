import type { Metadata } from "next";
import { getWordFields } from "@fsrs-japanese/shared-types";

import { notFound, redirect } from "next/navigation";
import { listDecksAction } from "@/lib/actions/decks.actions";
import { getCardByIdCached, getDeckCached } from "@/lib/data/route-reads";

import { TopBar } from "../../../_components/top-bar";
import { EditCardClient } from "./_components/edit-card-client";

interface Props { params: Promise<{ cardId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { cardId } = await params;
	const card = await getCardByIdCached(cardId);
	const wordFields = card === null ? null : getWordFields(card);
	return { title: wordFields !== null ? `Edit — ${wordFields.word}` : "Edit card" };
}

export default async function EditCardPage({ params }: Props): Promise<React.JSX.Element> {
	const { cardId } = await params;
	const card = await getCardByIdCached(cardId);

	// Guard rails, mirroring the card detail page plus the edit-specific limits:
	//  - no card / no deck → nothing meaningful to edit, back to the decks list.
	//  - premade source (userId === null) → shared across users, never mutated
	//    directly; the detail view already disables its Edit link for these.
	//  - non word-layout (sentence cards) → this editor only authors the
	//    vocabulary/grammar field set, so send those back to the detail view.
	if (card === null)
		notFound();
	if (card.deckId === null)
		redirect("/decks");
	if (card.userId === null)
		redirect(`/cards/${cardId}`);
	if (getWordFields(card) === null)
		redirect(`/cards/${cardId}`);

	// Fetch the current deck (for its name) and the user's active deck list (the
	// valid move targets) in parallel. The list excludes archived decks and never
	// includes premade sources (those are user_id NULL), so it's exactly the set
	// a card may be moved into.
	const [deck, decksPage] = await Promise.all([
		getDeckCached(card.deckId),
		listDecksAction(),
	]);

	// Map to the slim { id, name } shape the editor needs, and guarantee the
	// card's current deck is present even if it's archived (and thus absent from
	// the active list) — otherwise the selector would open on a blank value.
	const deckOptions = decksPage.items.map(d => ({ id: d.id, name: d.name }));
	if (!deckOptions.some(d => d.id === card.deckId)) {
		deckOptions.unshift({ id: card.deckId, name: deck?.name ?? "Current deck" });
	}

	return (
		<>
			<TopBar desktopHidden />
			<div className="flex min-h-full flex-col">
				<EditCardClient card={card} deckName={deck?.name ?? "your deck"} decks={deckOptions} />
			</div>
		</>
	);
}
