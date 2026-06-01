import { describe, expect, it } from "vitest";

import { resolveActiveHref } from "../nav-config";

// Active-state resolution is longest-prefix matching against the nav config.
// These cases pin the behavior that the earlier exact-match rule got wrong:
// a deck-detail route must light up the Decks section, while the prefix-
// sharing `/decks/premade` sibling must still win whenever the user is
// beneath it.
describe("resolveActiveHref", () => {
	it("matches a top-level row exactly", () => {
		expect(resolveActiveHref("/decks")).toBe("/decks");
		expect(resolveActiveHref("/today")).toBe("/today");
		expect(resolveActiveHref("/cards")).toBe("/cards");
	});

	it("lights up the section for a detail route (the deck-detail bug)", () => {
		expect(resolveActiveHref("/decks/abc123")).toBe("/decks");
		expect(resolveActiveHref("/decks/abc123/preview")).toBe("/decks");
	});

	it("prefers the more-specific sibling when the user is beneath it", () => {
		expect(resolveActiveHref("/decks/premade")).toBe("/decks/premade");
		expect(resolveActiveHref("/decks/premade/xyz")).toBe("/decks/premade");
	});

	it("matches detail routes of non-prefix-sharing sections", () => {
		expect(resolveActiveHref("/cards/card-1")).toBe("/cards");
		expect(resolveActiveHref("/cards/card-1/edit")).toBe("/cards");
		expect(resolveActiveHref("/weak-spots/drill/session-1")).toBe("/weak-spots");
	});

	it("resolves genuinely-nested insights rows to the deepest match", () => {
		expect(resolveActiveHref("/insights")).toBe("/insights");
		expect(resolveActiveHref("/insights/progress")).toBe("/insights/progress");
		expect(resolveActiveHref("/insights/forecast")).toBe("/insights/forecast");
	});

	it("returns null for routes with no nav representation", () => {
		expect(resolveActiveHref("/review/session")).toBeNull();
		expect(resolveActiveHref("/settings/profile")).toBeNull();
		expect(resolveActiveHref("/add")).toBeNull();
	});

	it("does not partial-match a sibling segment prefix", () => {
		// `/decksomething` must not match `/decks` — only full path segments count.
		expect(resolveActiveHref("/decksomething")).toBeNull();
	});
});
