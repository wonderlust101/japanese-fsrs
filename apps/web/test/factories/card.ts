/**
 * Factory functions for `ApiCard` and its projection shapes.
 *
 * The defaults satisfy the corresponding Zod schema in
 * `packages/shared-types/src/schemas/api-card.schema.ts` so factory output
 * can be fed straight into MSW handlers without re-parsing. The defaults
 * model a vocabulary-layout card with realistic Japanese fields
 * (`word: "水"`, `reading: "みず"`, `meaning: "water"`) — tests that need a
 * different layout or content pass an override.
 *
 * Factories must not import server-only modules (no `server-only`, no
 * Supabase service-role client, no Express types). Test files import these
 * under jsdom and any server-side leak would crash the suite at import.
 */

import type {
	ApiCard,
	ApiCardListItem,
	ApiCrossDeckCardListItem,
	ApiDueCard,
	FieldsData,
} from "@fsrs-japanese/shared-types";

import { State } from "@fsrs-japanese/shared-types";

// `State.New` = 0 in the numeric ts-fsrs enum. Surfaced explicitly so the
// factory's `state` field types as `State` (not the wider `number` that a
// literal would resolve to under `noImplicitAny`).
const STATE_NEW = State.New;

function defaultVocabularyFields(): FieldsData {
	return {
		word: "水",
		reading: "みず",
		meaning: "water",
		partOfSpeech: "noun",
		exampleSentences: [
			{
				ja: "水を飲みます。",
				en: "I drink water.",
				furigana: "みずをのみます。",
			},
		],
	};
}

export function makeCard(overrides: Partial<ApiCard> = {}): ApiCard {
	const base: ApiCard = {
		id: "11111111-1111-1111-1111-111111111111",
		userId: "user-1",
		deckId: "deck-1",
		premadeDeckId: null,
		layoutType: "vocabulary",
		fieldsData: defaultVocabularyFields(),
		parentCardId: null,
		jlptLevel: "N5",
		state: STATE_NEW,
		isSuspended: false,
		due: "2026-05-27T00:00:00.000Z",
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		learningSteps: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: "2026-05-01T00:00:00.000Z",
		updatedAt: "2026-05-01T00:00:00.000Z",
		version: 1,
	};
	return { ...base, ...overrides };
}

export function makeDueCard(overrides: Partial<ApiDueCard> = {}): ApiDueCard {
	const base: ApiDueCard = {
		id: "22222222-2222-2222-2222-222222222222",
		deckId: "deck-1",
		jlptLevel: "N5",
		state: STATE_NEW,
		due: "2026-05-27T00:00:00.000Z",
		fieldsData: defaultVocabularyFields(),
		layoutType: "vocabulary",
	};
	return { ...base, ...overrides };
}

export function makeCardListItem(overrides: Partial<ApiCardListItem> = {}): ApiCardListItem {
	const base: ApiCardListItem = {
		id: "33333333-3333-3333-3333-333333333333",
		fieldsData: defaultVocabularyFields(),
		layoutType: "vocabulary",
		jlptLevel: "N5",
		state: STATE_NEW,
		isSuspended: false,
		due: "2026-05-27T00:00:00.000Z",
	};
	return { ...base, ...overrides };
}

export function makeCrossDeckCardListItem(
	overrides: Partial<ApiCrossDeckCardListItem> = {},
): ApiCrossDeckCardListItem {
	const base: ApiCrossDeckCardListItem = {
		id: "44444444-4444-4444-4444-444444444444",
		fieldsData: defaultVocabularyFields(),
		layoutType: "vocabulary",
		jlptLevel: "N5",
		state: STATE_NEW,
		isSuspended: false,
		due: "2026-05-27T00:00:00.000Z",
		deckId: "deck-1",
		deckName: "Core 2k Vocabulary",
		lapses: 0,
	};
	return { ...base, ...overrides };
}
