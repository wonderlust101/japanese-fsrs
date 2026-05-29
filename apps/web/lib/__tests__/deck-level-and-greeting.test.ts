import { describe, expect, it } from "vitest";

import { inferDeckLevel } from "../deck-level";
import { getEnglishWelcomeClause, getGreetingBucket, getJapaneseGreeting } from "../japanese-greeting";

describe("inferDeckLevel", () => {
	it("extracts N5..N1 from deck name (case-insensitive)", () => {
		expect(inferDeckLevel({ name: "JLPT N5 essentials" })).toBe("N5");
		expect(inferDeckLevel({ name: "N3 vocabulary core" })).toBe("N3");
		expect(inferDeckLevel({ name: "Conquering N1" })).toBe("N1");
		expect(inferDeckLevel({ name: "jlpt n3 core" })).toBe("N3");
	});

	it("returns null when nothing matches", () => {
		expect(inferDeckLevel({ name: "Just words" })).toBeNull();
		expect(inferDeckLevel({})).toBeNull();
	});

	it("returns 'beyond_jlpt' on 'beyond' keyword", () => {
		expect(inferDeckLevel({ name: "Beyond JLPT — rare words" })).toBe("beyond_jlpt");
		expect(inferDeckLevel({ description: "deep cuts beyond the test" })).toBe("beyond_jlpt");
	});

	it("returns 'kana' on kana / hiragana / katakana", () => {
		expect(inferDeckLevel({ name: "Kana starters" })).toBe("kana");
		expect(inferDeckLevel({ name: "Hiragana drills" })).toBe("kana");
		expect(inferDeckLevel({ name: "Katakana practice" })).toBe("kana");
	});

	it("nX detection wins over 'beyond' / 'kana' (more specific)", () => {
		expect(inferDeckLevel({ name: "Hiragana N5 starter" })).toBe("N5");
	});

	it("considers name + title + description + subtitle (whitespace-joined)", () => {
		expect(inferDeckLevel({
			name: "",
			description: "Targeting N2 vocab",
		})).toBe("N2");
	});

	it("rejects substrings like 'WIN5' that aren't a standalone NX token", () => {
		expect(inferDeckLevel({ name: "WIN5 special" })).toBeNull();
	});

	it("treats null/empty input fields gracefully (and an omitted optional field too)", () => {
		// `title` is intentionally omitted rather than passed as `undefined` —
		// the type uses `exactOptionalPropertyTypes`, so the absence and the
		// explicit `undefined` are not interchangeable.
		expect(inferDeckLevel({
			name: null,
			description: "",
			subtitle: null,
		})).toBeNull();
	});
});

describe("getGreetingBucket boundaries (4/5/10/11/16/17/21/22)", () => {
	it("hour 4 → 'late' and hour 5 → 'morning'", () => {
		expect(getGreetingBucket(4)).toBe("late");
		expect(getGreetingBucket(5)).toBe("morning");
	});

	it("hour 10 → 'morning' and hour 11 → 'afternoon'", () => {
		expect(getGreetingBucket(10)).toBe("morning");
		expect(getGreetingBucket(11)).toBe("afternoon");
	});

	it("hour 16 → 'afternoon' and hour 17 → 'evening'", () => {
		expect(getGreetingBucket(16)).toBe("afternoon");
		expect(getGreetingBucket(17)).toBe("evening");
	});

	it("hour 21 → 'evening' and hour 22 → 'late'", () => {
		expect(getGreetingBucket(21)).toBe("evening");
		expect(getGreetingBucket(22)).toBe("late");
	});

	it("hour 0 and 23 → 'late' (wraparound boundary)", () => {
		expect(getGreetingBucket(0)).toBe("late");
		expect(getGreetingBucket(23)).toBe("late");
	});
});

describe("getJapaneseGreeting / getEnglishWelcomeClause", () => {
	it("getJapaneseGreeting returns the right phrase per bucket", () => {
		expect(getJapaneseGreeting(6)).toBe("おはよう");
		expect(getJapaneseGreeting(13)).toBe("こんにちは");
		expect(getJapaneseGreeting(19)).toBe("こんばんは");
		expect(getJapaneseGreeting(23)).toBe("おかえり");
	});

	it("getEnglishWelcomeClause maps bucket → clause", () => {
		expect(getEnglishWelcomeClause("morning")).toBe("Pour the coffee.");
		expect(getEnglishWelcomeClause("afternoon")).toBe("Pull up a chair.");
		expect(getEnglishWelcomeClause("evening")).toBe("The lamp is on.");
		expect(getEnglishWelcomeClause("late")).toBe("One or two is plenty.");
	});
});
