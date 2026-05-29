import type { CardsFilterState, ChipDimension, JlptFilter } from "../cards-filter-state";
import type { SavedViewRecipe } from "../saved-views-storage";

import { describe, expect, it } from "vitest";

import {
	chipsFromState,
	clearChip,
	DEFAULT_FILTER_STATE,
	effectiveSortDir,
	hasAnyChip,
	hasAnyFilter,
	mergeViewRecipe,
	naturalSortDirFor,
	parseFiltersFromURL,
	serializeFiltersToURL,
	stateMatchesRecipe,
} from "../cards-filter-state";

function readerFor(record: Record<string, string>): (key: string) => string | null {
	return key => (record[key] ?? null);
}

describe("parseFiltersFromURL", () => {
	it("returns DEFAULT_FILTER_STATE when no tokens are present", () => {
		const result = parseFiltersFromURL(readerFor({}));
		expect(result).toEqual(DEFAULT_FILTER_STATE);
	});

	it("tolerates junk tokens by falling back to defaults per dimension", () => {
		const result = parseFiltersFromURL(
			readerFor({
				jlpt: "garbage",
				status: "broken",
				sort: "nope",
				dir: "sideways",
				missing: "????",
				present: "audio",
				pitch: "huh",
				page: "abc",
			}),
		);
		expect(result.jlpt).toBe("all");
		expect(result.status).toBe("all");
		expect(result.sort).toBe("recent");
		expect(result.sortDir).toBeNull();
		expect(result.missingField).toBeNull();
		expect(result.presentField).toBeNull();
		expect(result.pitchPattern).toBeNull();
		expect(result.page).toBe(1);
	});

	it("ignores pitch=heiban unless present=pitch is also set", () => {
		expect(parseFiltersFromURL(readerFor({ pitch: "heiban" })).pitchPattern).toBeNull();
		expect(parseFiltersFromURL(readerFor({ present: "pitch", pitch: "heiban" })).pitchPattern).toBe("heiban");
	});

	it("clamps page to >=1 (junk / 0 / negative → default 1)", () => {
		expect(parseFiltersFromURL(readerFor({ page: "0" })).page).toBe(1);
		expect(parseFiltersFromURL(readerFor({ page: "-3" })).page).toBe(1);
		expect(parseFiltersFromURL(readerFor({ page: "5" })).page).toBe(5);
	});
});

describe("serializeFiltersToURL", () => {
	it("omits default values, including the natural sort dir and page=1", () => {
		const out = serializeFiltersToURL(DEFAULT_FILTER_STATE);
		expect(Array.from(out.entries())).toEqual([]);

		// 'asc' is the natural for 'due'; should be omitted.
		const natural = serializeFiltersToURL({ ...DEFAULT_FILTER_STATE, sort: "due", sortDir: "asc" });
		expect(natural.has("dir")).toBe(false);
		expect(natural.get("sort")).toBe("due");
	});

	it("retains explicitly diverging sort dir and page > 1", () => {
		const out = serializeFiltersToURL({
			...DEFAULT_FILTER_STATE,
			sort: "due",
			sortDir: "desc",
			page: 4,
		});
		expect(out.get("dir")).toBe("desc");
		expect(out.get("page")).toBe("4");
	});

	it("only serializes pitch when presentField === 'pitch'", () => {
		const withoutPresent = serializeFiltersToURL({
			...DEFAULT_FILTER_STATE,
			pitchPattern: "heiban",
		});
		expect(withoutPresent.has("pitch")).toBe(false);

		const withPresent = serializeFiltersToURL({
			...DEFAULT_FILTER_STATE,
			presentField: "pitch",
			pitchPattern: "heiban",
		});
		expect(withPresent.get("pitch")).toBe("heiban");
	});
});

describe("round-trip", () => {
	it("parse(serialize(state)) recovers a fully-loaded filter", () => {
		const state: CardsFilterState = {
			search: "neko",
			deckId: "deck-7",
			jlpt: "N3",
			status: "review",
			sort: "lapses",
			sortDir: "asc", // diverges from natural 'desc' for lapses
			viewId: "needs-attention",
			missingField: "mnemonic",
			presentField: "pitch",
			pitchPattern: "atamadaka",
			page: 4,
		};
		const params = serializeFiltersToURL(state);
		const parsed = parseFiltersFromURL(key => params.get(key));
		expect(parsed).toEqual(state);
	});
});

describe("naturalSortDirFor / effectiveSortDir", () => {
	it("per-axis natural defaults: recent=desc, due=asc, lapses=desc", () => {
		expect(naturalSortDirFor("recent")).toBe("desc");
		expect(naturalSortDirFor("due")).toBe("asc");
		expect(naturalSortDirFor("lapses")).toBe("desc");
	});

	it("effectiveSortDir uses natural when null, override when present", () => {
		expect(effectiveSortDir({ ...DEFAULT_FILTER_STATE, sort: "due", sortDir: null })).toBe("asc");
		expect(effectiveSortDir({ ...DEFAULT_FILTER_STATE, sort: "due", sortDir: "desc" })).toBe("desc");
	});
});

describe("mergeViewRecipe", () => {
	it("uRL state wins over recipe defaults", () => {
		const recipe: SavedViewRecipe = { status: "suspended", sort: "lapses" };
		const base: CardsFilterState = { ...DEFAULT_FILTER_STATE, status: "review", sort: "due" };
		const merged = mergeViewRecipe(base, recipe);
		expect(merged.status).toBe("review");
		expect(merged.sort).toBe("due");
	});

	it("fills in dimensions the base hasn't overridden, including pitchPattern when present=pitch", () => {
		const recipe: SavedViewRecipe = { pitchPattern: "heiban" };
		const merged = mergeViewRecipe({ ...DEFAULT_FILTER_STATE }, recipe);
		expect(merged.pitchPattern).toBeNull();

		const mergedWithPresent = mergeViewRecipe(
			{ ...DEFAULT_FILTER_STATE, presentField: "pitch" },
			recipe,
		);
		expect(mergedWithPresent.pitchPattern).toBe("heiban");
	});
});

describe("stateMatchesRecipe", () => {
	it("true when every recipe-defined axis matches; false on any divergence", () => {
		const recipe: SavedViewRecipe = { status: "suspended", sort: "lapses" };
		const matching: CardsFilterState = {
			...DEFAULT_FILTER_STATE,
			status: "suspended",
			sort: "lapses",
		};
		expect(stateMatchesRecipe(matching, recipe)).toBe(true);

		const diverging: CardsFilterState = { ...DEFAULT_FILTER_STATE, status: "new" };
		expect(stateMatchesRecipe(diverging, recipe)).toBe(false);
	});
});

describe("chipsFromState", () => {
	it("returns empty for default state and orders chips by dimension precedence", () => {
		expect(chipsFromState(DEFAULT_FILTER_STATE)).toEqual([]);

		const loaded: CardsFilterState = {
			...DEFAULT_FILTER_STATE,
			jlpt: "N3",
			status: "review",
			missingField: "mnemonic",
			presentField: "pitch",
			pitchPattern: "heiban",
		};
		expect(chipsFromState(loaded).map(c => c.dim)).toEqual([
			"jlpt",
			"status",
			"missing",
			"present",
			"pitchPattern",
		]);
	});

	it("'beyond' renders 'Beyond JLPT' and pitchPattern hides when present !== 'pitch'", () => {
		const beyond: CardsFilterState = { ...DEFAULT_FILTER_STATE, jlpt: "beyond" as JlptFilter };
		expect(chipsFromState(beyond)[0]?.label).toBe("Beyond JLPT");

		const noPitchPresent: CardsFilterState = {
			...DEFAULT_FILTER_STATE,
			pitchPattern: "heiban",
			presentField: "picture",
		};
		expect(chipsFromState(noPitchPresent).map(c => c.dim)).not.toContain("pitchPattern");
	});
});

describe("clearChip", () => {
	it("clears each chip dimension correctly; 'present' also clears the dependent pitchPattern", () => {
		const state: CardsFilterState = {
			...DEFAULT_FILTER_STATE,
			jlpt: "N3",
			status: "review",
			missingField: "mnemonic",
			presentField: "pitch",
			pitchPattern: "heiban",
		};
		expect(clearChip(state, "jlpt").jlpt).toBe("all");
		expect(clearChip(state, "status").status).toBe("all");
		expect(clearChip(state, "missing").missingField).toBeNull();
		expect(clearChip(state, "pitchPattern").pitchPattern).toBeNull();

		const cleared = clearChip(state, "present");
		expect(cleared.presentField).toBeNull();
		expect(cleared.pitchPattern).toBeNull();
	});

	it("is exhaustive over every ChipDimension (does not throw)", () => {
		const dims: ChipDimension[] = ["jlpt", "status", "missing", "present", "pitchPattern"];
		for (const dim of dims) {
			expect(() => clearChip(DEFAULT_FILTER_STATE, dim)).not.toThrow();
		}
	});
});

describe("hasAnyChip / hasAnyFilter", () => {
	it("hasAnyChip is false for default state but true once a chip dimension is set", () => {
		expect(hasAnyChip(DEFAULT_FILTER_STATE)).toBe(false);
		expect(hasAnyFilter(DEFAULT_FILTER_STATE)).toBe(false);

		const search: CardsFilterState = { ...DEFAULT_FILTER_STATE, search: "neko" };
		expect(hasAnyChip(search)).toBe(false);
		expect(hasAnyFilter(search)).toBe(true);

		const view: CardsFilterState = { ...DEFAULT_FILTER_STATE, viewId: "needs-attention" };
		expect(hasAnyChip(view)).toBe(false);
		expect(hasAnyFilter(view)).toBe(true);
	});
});
