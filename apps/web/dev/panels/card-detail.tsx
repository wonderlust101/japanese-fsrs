"use client";

import type { ApiCard } from "@fsrs-japanese/shared-types";
import type { DevFixtureSpec } from "@/dev";

import { State } from "@fsrs-japanese/shared-types";
import { useDevStatePanel } from "@/dev";

export type CardDevFixtureKey
	= | "off"
		| "full"
		| "failing"
		| "suspended"
		| "premade"
		| "sparse"
		| "loading";

export interface CardDevState {
	fixture: CardDevFixtureKey;
	/** Synthetic card to render when fixture is not `off` / `loading`. */
	card: ApiCard | null;
	loading: boolean;
}

const FIXTURES: ReadonlyArray<DevFixtureSpec<CardDevFixtureKey>> = [
	{ key: "off", label: "Live data", description: "Real card from the API." },
	{ key: "full", label: "Full card", description: "All fields populated: sentences, mnemonic, kanji, image." },
	{ key: "failing", label: "Failing", description: "High lapses (12). Repair note appears under the meta strip." },
	{ key: "suspended", label: "Suspended", description: "Suspended badge in hero; Suspend becomes Unsuspend." },
	{ key: "premade", label: "Premade", description: "Source card with userId = null. Edit / Move / Delete disabled." },
	{ key: "sparse", label: "Sparse", description: "No sentences, mnemonic, or image. Tests empty-state suggestions." },
	{ key: "loading", label: "Loading", description: "Skeleton state." },
];

export function useCardDevState(deckId: string): CardDevState {
	const { fixture } = useDevStatePanel({
		id: "cards.detail",
		title: "Cards · Detail",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const card = fixture === "off" || fixture === "loading" ? null : buildFixtureCard(fixture, deckId);

	return {
		fixture,
		card,
		loading: fixture === "loading",
	};
}

// ── Fixtures ──────────────────────────────────────────────────────────────

function buildFixtureCard(key: Exclude<CardDevFixtureKey, "off" | "loading">, deckId: string): ApiCard {
	const base = baseFixtureCard(deckId);

	switch (key) {
		case "full":
			return base;
		case "failing":
			return { ...base, lapses: 12, state: State.Relearning };
		case "suspended":
			return { ...base, isSuspended: true };
		case "premade":
			return { ...base, userId: null } as ApiCard;
		case "sparse":
			return {
				...base,
				fieldsData: {
					word: "大学",
					reading: "だいがく",
					meaning: "university",
					partOfSpeech: "noun",
				} as ApiCard["fieldsData"],
			};
	}
}

function baseFixtureCard(deckId: string): ApiCard {
	return ({
		id: "dev-fixture-card",
		deckId,
		userId: "dev-fixture-user",
		layoutType: "vocabulary",
		jlptLevel: "N3",
		state: State.Review,
		isSuspended: false,
		due: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
		stability: 14.2,
		difficulty: 5.6,
		reps: 18,
		lapses: 2,
		elapsedDays: 1,
		scheduledDays: 4,
		lastReview: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
		version: 7,
		parentCardId: null,
		embeddingHash: null,
		createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
		updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
		fieldsData: {
			word: "大学",
			reading: "だいがく",
			meaning: "university; college",
			partOfSpeech: "noun",
			frequencyRank: 812,
			pitchPosition: 0,
			pitchAccent: "heiban",
			nuance: "大学 (daigaku) is the standard term for a four-year university or college. It contrasts with 大学院 (daigakuin, \"graduate school\") and 短大 (tandai, \"junior college\"). In casual speech the abbreviation 大 stands in for the full word in compounds like 東大 (Tokyo University) or 京大 (Kyoto University). The word does not imply prestige on its own; reputation is conveyed by the institution name in front of it.",
			exampleSentences: [
				{ ja: "私は大学に行きます。", furigana: "わたしはだいがくにいきます。", en: "I go to the university." },
				{ ja: "彼は東京大学を卒業しました。", furigana: "かれはとうきょうだいがくをそつぎょうしました。", en: "He graduated from Tokyo University." },
				{ ja: "この大学は古い歴史を持っています。", furigana: "このだいがくはふるいれきしをもっています。", en: "This university has a long history." },
			],
			kanjiBreakdown: [
				{ kanji: "大", radical: "大 (big)", meaning: "big, large, great", reading: "ダイ・タイ / おお（きい）" },
				{ kanji: "学", radical: "子 (child)", meaning: "study, learning", reading: "ガク / まな（ぶ）" },
			],
			mnemonic: "A “big study” place. When a child (子, inside 学) grows BIG enough to take their STUDY seriously, they head to 大学.",
			image: "https://placehold.co/600x320?text=%E5%A4%A7%E5%AD%A6",
		} as unknown as ApiCard["fieldsData"],
	} as unknown) as ApiCard;
}
