import { describe, expect, it } from "bun:test";

import {
	deepHasMarkup,
	deepHasOversizedString,
	looksLikeHtml,
	sanitizeForPrompt,
	stripHtml,
} from "../sanitize.ts";

// Phase 4 — edge-case & determinism matrix, the Unicode / emoji / RTL +
// sanitization cells. `sanitizeForPrompt` is the only barrier between raw user
// input (word, interests, native language) and an LLM prompt; the deep* helpers
// gate AI *output* before it is persisted. None had unit coverage. These pin the
// observable contract: markup is stripped, prompt-structure characters are
// dropped, length is bounded — while legitimate CJK / emoji / RTL text passes
// through untouched (over-aggressive stripping would silently mangle the very
// Japanese the product exists to teach).

describe("sanitizeForPrompt — markup stripping", () => {
	it("removes HTML tags but keeps their inner text", () => {
		expect(sanitizeForPrompt("<script>alert(1)</script>水")).toBe("alert(1)水");
	});

	it("removes a self-closing / attribute-laden tag entirely", () => {
		expect(sanitizeForPrompt("<img src=x onerror=alert(1)>safe")).toBe("safe");
	});
});

describe("sanitizeForPrompt — prompt-structure characters", () => {
	it("drops backticks and single/double quotes that could break out of the prompt", () => {
		expect(sanitizeForPrompt("say \"hi\" it's `code`")).toBe("say hi its code");
	});

	it("collapses CR / LF / tab runs into a single space", () => {
		expect(sanitizeForPrompt("line1\r\n\nline2\t\tend")).toBe("line1 line2 end");
	});

	it("collapses runs of 2+ spaces into one and trims the ends", () => {
		expect(sanitizeForPrompt("   a      b   ")).toBe("a b");
	});

	it("returns an empty string for empty input", () => {
		expect(sanitizeForPrompt("")).toBe("");
	});
});

describe("sanitizeForPrompt — Unicode / emoji / RTL pass through", () => {
	it("preserves CJK characters and emoji verbatim", () => {
		// The whole product is Japanese; stripping non-ASCII would be a silent
		// data-loss bug. Emoji (surrogate pairs) must survive too.
		expect(sanitizeForPrompt("水 💧 みず 漢字")).toBe("水 💧 みず 漢字");
	});

	it("preserves right-to-left script and its directional marks", () => {
		// U+200F (RTL MARK) is outside the \s class the collapse steps target, so
		// bidi text is left intact rather than corrupted into LTR.
		const rtl = "مرحبا‏";
		expect(sanitizeForPrompt(rtl)).toContain("مرحبا");
	});
});

describe("sanitizeForPrompt — length cap", () => {
	it("caps at the default 100 characters", () => {
		expect(sanitizeForPrompt("あ".repeat(150))).toHaveLength(100);
	});

	it("honours a custom maxLen", () => {
		expect(sanitizeForPrompt("abcdefghij", 4)).toBe("abcd");
	});

	it("applies the cap AFTER trimming, so leading whitespace does not eat the budget", () => {
		// trim → 'xxxxxxxxxx' (10) → slice(0,5). If slice ran before trim the
		// result would be the 5 leading spaces, sliced to ''.
		expect(sanitizeForPrompt(`     ${"x".repeat(10)}`, 5)).toBe("xxxxx");
	});
});

describe("stripHtml", () => {
	it("removes every tag-like substring", () => {
		expect(stripHtml("<b>水</b> and <i>火</i>")).toBe("水 and 火");
	});

	it("leaves tag-free text unchanged", () => {
		expect(stripHtml("no tags here 水")).toBe("no tags here 水");
	});
});

describe("looksLikeHtml", () => {
	it("flags an opening tag", () => {
		expect(looksLikeHtml("<script>x</script>")).toBe(true);
	});

	it("flags javascript: and inline event-handler vectors without an angle bracket", () => {
		expect(looksLikeHtml("javascript:alert(1)")).toBe(true);
		expect(looksLikeHtml("onerror=alert(1)")).toBe(true);
	});

	it("does NOT flag plain text or bare math comparisons (avoids false positives)", () => {
		// `<` must be immediately followed by a letter to read as a tag, so
		// arithmetic like "2 < 3" is not markup.
		expect(looksLikeHtml("plain 水 text")).toBe(false);
		expect(looksLikeHtml("2 < 3 and 4 > 1")).toBe(false);
	});
});

describe("deepHasMarkup", () => {
	it("finds a markup string nested inside objects and arrays", () => {
		expect(deepHasMarkup({ a: { b: ["ok", "<script>"] } })).toBe(true);
	});

	it("returns false when every string leaf is clean", () => {
		expect(deepHasMarkup({ a: ["水", 123, null, true] })).toBe(false);
	});
});

describe("deepHasOversizedString", () => {
	it("finds a string leaf longer than maxLen anywhere in the tree", () => {
		expect(deepHasOversizedString({ a: { b: "x".repeat(50) } }, 10)).toBe(true);
	});

	it("ignores non-string leaves and returns false when all strings fit", () => {
		expect(deepHasOversizedString(["short", { n: 999999 }], 10)).toBe(false);
	});
});
