/**
 * MSW handlers for `/api/v1/cards/*` (the cards browser, detail view, and
 * per-deck card list).
 *
 * Endpoints covered:
 *   • GET  /api/v1/cards/cross-deck      — the cards browser table
 *   • GET  /api/v1/decks/:deckId/cards   — per-deck card list
 *   • GET  /api/v1/cards/:id             — single-card detail
 *   • POST /api/v1/cards                 — create a card (AI-backed)
 *   • PATCH /api/v1/cards/:id            — update a card
 *   • DELETE /api/v1/cards/:id           — soft / hard delete a card
 */

import type {
	ApiCard,
	ApiCardListItem,
	ApiCrossDeckCardListItem,
} from "@fsrs-japanese/shared-types";
import type { HttpHandler } from "msw";

import { http, HttpResponse } from "msw";

import {
	makeCard,
	makeCardListItem,
	makeCrossDeckCardListItem,
} from "../../factories/card";

interface ListEnvelope<T> {
	items: T[];
	nextCursor: string | null;
	hasMore: boolean;
	totalCount?: number;
}

function envelope<T>(items: T[], totalCount?: number): ListEnvelope<T> {
	// Build without spreading `totalCount: undefined` — exactOptionalPropertyTypes
	// rejects that, so we only set the key when a value was provided.
	const base: ListEnvelope<T> = { items, nextCursor: null, hasMore: false };
	return totalCount === undefined ? base : { ...base, totalCount };
}

// ─── Happy-path defaults ────────────────────────────────────────────────────

const cardsHandlers: HttpHandler[] = [
	http.get("*/api/v1/cards/cross-deck", () => HttpResponse.json(
		envelope([makeCrossDeckCardListItem()], 1),
	)),

	http.get("*/api/v1/decks/:deckId/cards", () => HttpResponse.json(
		envelope([makeCardListItem()]),
	)),

	http.get("*/api/v1/cards/:id", ({ params }) => HttpResponse.json(
		makeCard({ id: String(params.id) }),
	)),

	http.post("*/api/v1/cards", () => HttpResponse.json(
		makeCard({ id: "card-new" }),
		{ status: 201 },
	)),

	http.patch("*/api/v1/cards/:id", ({ params }) => HttpResponse.json(
		makeCard({ id: String(params.id), version: 2 }),
	)),

	http.delete("*/api/v1/cards/:id", () => new HttpResponse(null, { status: 204 })),
];

export default cardsHandlers;

// ─── Named per-test helpers ─────────────────────────────────────────────────

export function mockListCrossDeckCardsSuccess(
	items: ApiCrossDeckCardListItem[] = [makeCrossDeckCardListItem()],
	totalCount: number = items.length,
): HttpHandler {
	return http.get("*/api/v1/cards/cross-deck", () => HttpResponse.json(envelope(items, totalCount)));
}

export function mockListCrossDeckCardsEmpty(): HttpHandler {
	return http.get("*/api/v1/cards/cross-deck", () => HttpResponse.json(
		envelope<ApiCrossDeckCardListItem>([], 0),
	));
}

export function mockListDeckCardsSuccess(items: ApiCardListItem[] = [makeCardListItem()]): HttpHandler {
	return http.get("*/api/v1/decks/:deckId/cards", () => HttpResponse.json(envelope(items)));
}

export function mockGetCardSuccess(card: ApiCard = makeCard()): HttpHandler {
	return http.get("*/api/v1/cards/:id", () => HttpResponse.json(card));
}

export function mockGetCardNotFound(): HttpHandler {
	return http.get("*/api/v1/cards/:id", () => HttpResponse.json(
		{ error: "Card not found", code: "CARD_NOT_FOUND" },
		{ status: 404 },
	));
}

export function mockCreateCardSuccess(card: ApiCard = makeCard({ id: "card-new" })): HttpHandler {
	return http.post("*/api/v1/cards", () => HttpResponse.json(card, { status: 201 }));
}

export function mockCreateCardRateLimited(): HttpHandler {
	return http.post("*/api/v1/cards", () => HttpResponse.json(
		{ error: "Daily AI quota exceeded", code: "AI_QUOTA_EXCEEDED" },
		{ status: 429 },
	));
}

export function mockUpdateCardSuccess(card: ApiCard = makeCard({ version: 2 })): HttpHandler {
	return http.patch("*/api/v1/cards/:id", () => HttpResponse.json(card));
}

export function mockUpdateCardConflict(): HttpHandler {
	return http.patch("*/api/v1/cards/:id", () => HttpResponse.json(
		{ error: "Card was modified by another process", code: "OPTIMISTIC_CONCURRENCY_CONFLICT" },
		{ status: 409 },
	));
}

export function mockDeleteCardSuccess(): HttpHandler {
	return http.delete("*/api/v1/cards/:id", () => new HttpResponse(null, { status: 204 }));
}
