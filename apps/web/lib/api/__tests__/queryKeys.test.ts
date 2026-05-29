import { describe, expect, it } from "vitest";

import { queryKeys } from "../queryKeys";

// ── Tuple shapes ─────────────────────────────────────────────────────────────

describe("queryKeys — tuple shapes", () => {
	it("preserves an immutable tuple shape via 'as const'", () => {
		// `satisfies readonly unknown[]` checks the type is a readonly tuple/array.
		const decksAll = queryKeys.decks.all() satisfies readonly unknown[];
		expect(decksAll).toEqual(["decks"]);
	});

	it("decks.list / detail prefix with all()", () => {
		const all = queryKeys.decks.all();
		expect(queryKeys.decks.list().slice(0, all.length)).toEqual(all);
		expect(queryKeys.decks.detail("deck-1").slice(0, all.length)).toEqual(all);
	});

	it("cards.byDeck / detail / similar / crossDeck / qualityIssues prefix with cards.all()", () => {
		const all = queryKeys.cards.all();
		expect(queryKeys.cards.byDeck("d").slice(0, all.length)).toEqual(all);
		expect(queryKeys.cards.detail("c").slice(0, all.length)).toEqual(all);
		expect(queryKeys.cards.similar("c").slice(0, all.length)).toEqual(all);
		expect(queryKeys.cards.crossDeck({}).slice(0, all.length)).toEqual(all);
		expect(queryKeys.cards.qualityIssues().slice(0, all.length)).toEqual(all);
	});

	it("weakSpots.list / detail / drillSession prefix with weakSpots.all()", () => {
		const all = queryKeys.weakSpots.all();
		expect(queryKeys.weakSpots.list({}).slice(0, all.length)).toEqual(all);
		expect(queryKeys.weakSpots.detail("w").slice(0, all.length)).toEqual(all);
		expect(queryKeys.weakSpots.drillSession("d").slice(0, all.length)).toEqual(all);
	});

	it("premadeDecks.list / detail prefix with premadeDecks.all()", () => {
		const all = queryKeys.premadeDecks.all();
		expect(queryKeys.premadeDecks.list().slice(0, all.length)).toEqual(all);
		expect(queryKeys.premadeDecks.detail("p").slice(0, all.length)).toEqual(all);
	});

	it("reviews.due / forecast / summary / preview have stable static prefixes", () => {
		expect(queryKeys.reviews.due()).toEqual(["reviews", "due"]);
		expect(queryKeys.reviews.forecast()).toEqual(["reviews", "forecast"]);
		expect(queryKeys.reviews.summary("s")).toEqual(["reviews", "summary", "s"]);
		expect(queryKeys.reviews.preview("c")).toEqual(["reviews", "preview", "c"]);
	});

	it("reviews.dayReflection uses sessionId in the key", () => {
		const k = queryKeys.reviews.dayReflection("session-123");
		expect(k).toEqual(["reviews", "day-reflection", "session-123"]);
	});

	it("analytics.dashboard is a 1-element static key", () => {
		expect(queryKeys.analytics.dashboard()).toEqual(["analytics", "dashboard"]);
	});

	it("profile.me is a 2-element static key", () => {
		expect(queryKeys.profile.me()).toEqual(["profile", "me"]);
	});

	it("tomo.note threads the dateKey", () => {
		expect(queryKeys.tomo.note("2026-05-27")).toEqual(["tomo", "note", "2026-05-27"]);
	});
});

// ── Identity / inequality across argumented keys ────────────────────────────

describe("queryKeys — distinct arguments yield distinct keys", () => {
	it("cards.crossDeck builds a different key for a different filter object", () => {
		const a = queryKeys.cards.crossDeck({ status: "review" });
		const b = queryKeys.cards.crossDeck({ status: "new" });
		expect(a).not.toEqual(b);
	});

	it("insights.maturityHistory distinguishes between window strings", () => {
		const a = queryKeys.insights.maturityHistory("90");
		const b = queryKeys.insights.maturityHistory("365");
		expect(a).not.toEqual(b);
	});

	it("insights.distributions is a 2-element static key", () => {
		expect(queryKeys.insights.distributions()).toEqual(["insights", "distributions"]);
	});

	it("weakSpots.list keys differ across filter shapes", () => {
		const a = queryKeys.weakSpots.list({ resolved: false });
		const b = queryKeys.weakSpots.list({ resolved: true });
		expect(a).not.toEqual(b);
	});

	it("decks.detail keys differ across ids", () => {
		expect(queryKeys.decks.detail("a")).not.toEqual(queryKeys.decks.detail("b"));
	});
});

// ── Same arguments produce structurally equal keys ──────────────────────────

describe("queryKeys — same arguments produce equal keys (structurally)", () => {
	it("identical filter objects with same property order produce equal tuples", () => {
		const a = queryKeys.cards.crossDeck({ status: "review" });
		const b = queryKeys.cards.crossDeck({ status: "review" });
		expect(a).toEqual(b);
	});

	it("equal but distinct id strings produce equal keys", () => {
		expect(queryKeys.cards.detail("c1")).toEqual(queryKeys.cards.detail("c1"));
	});
});
