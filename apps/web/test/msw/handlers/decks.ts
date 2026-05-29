/**
 * MSW handlers for `/api/v1/decks/*` and `/api/v1/premade-decks/*`.
 *
 * The default export covers list / detail / create / update / delete /
 * premade-list for a single happy-path deck. Tests that need richer
 * scenarios (empty list, archived view, write conflicts) call the named
 * helpers and pass the result to `server.use(...)`.
 *
 * Response shapes mirror the production wire shape: list endpoints return
 * the `apiListEnvelope` `{ items, nextCursor, hasMore }` triple; detail
 * endpoints return the unwrapped resource.
 */

import type {
	ApiDeck,
	ApiDeckWithStats,
	ApiPremadeDeck,
} from "@fsrs-japanese/shared-types";
import type { HttpHandler } from "msw";

import { http, HttpResponse } from "msw";

import { makeDeck, makeDeckWithStats, makePremadeDeck } from "../../factories/deck";

interface ListEnvelope<T> {
	items: T[];
	nextCursor: string | null;
	hasMore: boolean;
	totalCount?: number;
}

function envelope<T>(items: T[]): ListEnvelope<T> {
	return { items, nextCursor: null, hasMore: false };
}

// ─── Happy-path defaults ────────────────────────────────────────────────────

const decksHandlers: HttpHandler[] = [
	http.get("*/api/v1/decks", () => HttpResponse.json(envelope([makeDeckWithStats()]))),

	http.get("*/api/v1/decks/:id", ({ params }) => HttpResponse.json(
		makeDeckWithStats({ id: String(params.id) }),
	)),

	http.post("*/api/v1/decks", () => HttpResponse.json(
		makeDeck({ id: "deck-new", name: "New Deck", cardCount: 0 }),
		{ status: 201 },
	)),

	http.patch("*/api/v1/decks/:id", ({ params }) => HttpResponse.json(
		makeDeck({ id: String(params.id), version: 2 }),
	)),

	http.delete("*/api/v1/decks/:id", () => new HttpResponse(null, { status: 204 })),

	http.get("*/api/v1/premade-decks", () => HttpResponse.json(envelope([makePremadeDeck()]))),
];

export default decksHandlers;

// ─── Named per-test helpers ─────────────────────────────────────────────────

export function mockListDecksSuccess(decks: ApiDeckWithStats[] = [makeDeckWithStats()]): HttpHandler {
	return http.get("*/api/v1/decks", () => HttpResponse.json(envelope(decks)));
}

export function mockListDecksEmpty(): HttpHandler {
	return http.get("*/api/v1/decks", () => HttpResponse.json(envelope<ApiDeckWithStats>([])));
}

export function mockGetDeckSuccess(deck: ApiDeckWithStats = makeDeckWithStats()): HttpHandler {
	return http.get("*/api/v1/decks/:id", () => HttpResponse.json(deck));
}

export function mockGetDeckNotFound(): HttpHandler {
	return http.get("*/api/v1/decks/:id", () => HttpResponse.json(
		{ error: "Deck not found", code: "DECK_NOT_FOUND" },
		{ status: 404 },
	));
}

export function mockCreateDeckSuccess(deck: ApiDeck = makeDeck({ id: "deck-new", cardCount: 0 })): HttpHandler {
	return http.post("*/api/v1/decks", () => HttpResponse.json(deck, { status: 201 }));
}

export function mockUpdateDeckSuccess(deck: ApiDeck = makeDeck({ version: 2 })): HttpHandler {
	return http.patch("*/api/v1/decks/:id", () => HttpResponse.json(deck));
}

export function mockUpdateDeckConflict(): HttpHandler {
	return http.patch("*/api/v1/decks/:id", () => HttpResponse.json(
		{ error: "Deck was modified by another process", code: "OPTIMISTIC_CONCURRENCY_CONFLICT" },
		{ status: 409 },
	));
}

export function mockDeleteDeckSuccess(): HttpHandler {
	return http.delete("*/api/v1/decks/:id", () => new HttpResponse(null, { status: 204 }));
}

export function mockListPremadeDecksSuccess(decks: ApiPremadeDeck[] = [makePremadeDeck()]): HttpHandler {
	return http.get("*/api/v1/premade-decks", () => HttpResponse.json(envelope(decks)));
}
