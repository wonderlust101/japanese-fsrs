/**
 * Factory functions for `ApiDeck`, `ApiDeckWithStats`, and `ApiPremadeDeck`.
 *
 * Defaults satisfy the corresponding Zod schemas in
 * `packages/shared-types/src/schemas/api-deck.schema.ts`. A deck is an active
 * (non-archived) vocabulary deck with one card by default; tests that need
 * an archived deck or a different deckType pass an override.
 */

import type {
	ApiDeck,
	ApiDeckWithStats,
	ApiPremadeDeck,
} from "@fsrs-japanese/shared-types";

export function makeDeck(overrides: Partial<ApiDeck> = {}): ApiDeck {
	const base: ApiDeck = {
		id: "deck-1",
		name: "Core 2k Vocabulary",
		description: "First 2,000 high-frequency Japanese words.",
		deckType: "vocabulary",
		cardCount: 1,
		sourcePremadeId: null,
		version: 1,
		createdAt: "2026-05-01T00:00:00.000Z",
		updatedAt: "2026-05-01T00:00:00.000Z",
		archivedAt: null,
	};
	return { ...base, ...overrides };
}

export function makeDeckWithStats(overrides: Partial<ApiDeckWithStats> = {}): ApiDeckWithStats {
	const base: ApiDeckWithStats = {
		...makeDeck(),
		dueCount: 0,
		newCount: 1,
		matureCount: 0,
		dueNewCount: 0,
		dueReviewCount: 0,
		lastReviewedAt: null,
	};
	return { ...base, ...overrides };
}

export function makePremadeDeck(overrides: Partial<ApiPremadeDeck> = {}): ApiPremadeDeck {
	const base: ApiPremadeDeck = {
		id: "premade-1",
		name: "JLPT N5 Essentials",
		description: "Core 800 words tested on the N5.",
		deckType: "vocabulary",
		jlptLevel: "N5",
		domain: null,
		cardCount: 800,
		isActive: true,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
	return { ...base, ...overrides };
}
