"use client";

import type { CardMissingField, CardPresentField, CardSortDir, CardSortField, CardStatusFilter, CrossDeckJlptFilter, PitchPattern } from "@fsrs-japanese/shared-types";

import type { SavedViewRecipe } from "./saved-views-storage";
import {
	assertNever,
	crossDeckJlptFilterEnum,

} from "@fsrs-japanese/shared-types";

// ─── Types ──────────────────────────────────────────────────────────────

// The /cards JLPT filter is exactly the cross-deck endpoint's filter token
// set, so alias the canonical shared-types type instead of re-spelling the
// union — keeps the wire mapping single-sourced. NOTE: this is intentionally
// distinct from the premade catalogue's `'all' | JLPTLevel`, which filters by
// the raw enum value (`beyond_jlpt`), not this derived `beyond` bucket.
export type JlptFilter = CrossDeckJlptFilter;

/**
 * Canonical filter state for /cards. Single source of truth: the URL
 * search params serialize to this shape and back. Every UI affordance
 * (toolbar dropdowns, chips, view picker, mobile sheet) reads and writes
 * the same object.
 *
 * Defaults are "all / none" so a clean URL renders the unfiltered list.
 */
export interface CardsFilterState {
	search: string;
	deckId: string | "all";
	jlpt: JlptFilter;
	status: CardStatusFilter;
	sort: CardSortField;
	/**
	 * Sort direction. `null` means "use the per-axis natural default"
	 * (recent → desc, due → asc, lapses → desc). A non-null value is
	 * recorded only when the user explicitly toggles direction; this
	 * keeps the URL short for the common case and ensures changing the
	 * sort axis resets to that axis's natural default automatically.
	 */
	sortDir: CardSortDir | null;
	viewId: string | null;
	missingField: CardMissingField | null;
	presentField: CardPresentField | null;
	pitchPattern: PitchPattern | null;
	/**
	 * 1-indexed current page. Lives in state (rather than as separate
	 * orchestrator-only state) so it serializes into the URL alongside
	 * the other filters. Page 1 is the implicit default and is omitted
	 * from URLs to keep clean links.
	 */
	page: number;
}

export const DEFAULT_FILTER_STATE: CardsFilterState = {
	search: "",
	deckId: "all",
	jlpt: "all",
	status: "all",
	sort: "recent",
	sortDir: null,
	viewId: null,
	missingField: null,
	presentField: null,
	pitchPattern: null,
	page: 1,
};

/**
 * Per-axis natural sort direction. Used for the UI's direction toggle
 * (so the button always renders the *effective* arrow regardless of
 * whether the user has overridden) and for resolving the wire
 * `sortDir` value when null is shorthand for "natural".
 */
export function naturalSortDirFor(sort: CardSortField): CardSortDir {
	switch (sort) {
		case "recent": return "desc";
		case "due": return "asc";
		case "lapses": return "desc";
		default: return assertNever(sort);
	}
}

/** Effective sort direction: explicit override if set, else per-axis natural. */
export function effectiveSortDir(state: CardsFilterState): CardSortDir {
	return state.sortDir ?? naturalSortDirFor(state.sort);
}

// ─── Token whitelists ───────────────────────────────────────────────────
// Tolerant parse: unknown values fall back to the default for that dim.

// Derived from the canonical enum so the whitelist can never drift from the
// shared-types token set.
const JLPT_TOKENS: ReadonlySet<JlptFilter> = new Set(crossDeckJlptFilterEnum.options);
const STATUS_TOKENS: ReadonlySet<CardStatusFilter> = new Set([
	"all",
	"new",
	"learning",
	"review",
	"suspended",
]);
const SORT_TOKENS: ReadonlySet<CardSortField> = new Set(["recent", "due", "lapses"]);
const SORT_DIR_TOKENS: ReadonlySet<CardSortDir> = new Set(["asc", "desc"]);
const MISSING_TOKENS: ReadonlySet<CardMissingField> = new Set([
	"reading",
	"meaning",
	"example",
	"mnemonic",
	"picture",
	"nuance",
	"pitch",
]);
const PRESENT_TOKENS: ReadonlySet<CardPresentField> = new Set(["picture", "pitch"]);
const PATTERN_TOKENS: ReadonlySet<PitchPattern> = new Set([
	"heiban",
	"atamadaka",
	"nakadaka",
	"odaka",
]);

// ─── Parse ──────────────────────────────────────────────────────────────

/**
 * Build a `CardsFilterState` from a URLSearchParams-like reader. Defensive:
 * any token outside the whitelist resolves to the default for that field
 * so a hand-typed URL can never crash the page.
 */
export function parseFiltersFromURL(
	read: (key: string) => string | null,
): CardsFilterState {
	const next: CardsFilterState = { ...DEFAULT_FILTER_STATE };

	const q = read("q");
	if (q !== null && q.length > 0)
		next.search = q;

	const deck = read("deck");
	if (deck !== null && deck.length > 0)
		next.deckId = deck;

	const jlpt = read("jlpt");
	if (jlpt !== null && JLPT_TOKENS.has(jlpt as JlptFilter)) {
		next.jlpt = jlpt as JlptFilter;
	}

	const status = read("status");
	if (status !== null && STATUS_TOKENS.has(status as CardStatusFilter)) {
		next.status = status as CardStatusFilter;
	}

	const sort = read("sort");
	if (sort !== null && SORT_TOKENS.has(sort as CardSortField)) {
		next.sort = sort as CardSortField;
	}

	// `dir` is recorded only when the user has overridden the per-axis
	// natural direction. A `dir` value that matches the natural default
	// for the resolved sort is intentionally dropped at serialize time
	// (so it doesn't appear in clean URLs), but accepted on parse for
	// robustness against hand-typed links.
	const dir = read("dir");
	if (dir !== null && SORT_DIR_TOKENS.has(dir as CardSortDir)) {
		next.sortDir = dir as CardSortDir;
	}

	// Page is 1-indexed; default 1 when missing or invalid. Defensive
	// parse against junk values so a hand-typed `?page=abc` doesn't
	// corrupt the orchestrator.
	const pageRaw = read("page");
	if (pageRaw !== null) {
		const parsed = Number.parseInt(pageRaw, 10);
		if (Number.isFinite(parsed) && parsed >= 1) {
			next.page = parsed;
		}
	}

	const view = read("view");
	if (view !== null && view.length > 0)
		next.viewId = view;

	const missing = read("missing");
	if (missing !== null && MISSING_TOKENS.has(missing as CardMissingField)) {
		next.missingField = missing as CardMissingField;
	}

	const present = read("present");
	if (present !== null && PRESENT_TOKENS.has(present as CardPresentField)) {
		next.presentField = present as CardPresentField;
	}

	const pitch = read("pitch");
	if (
		pitch !== null
		&& PATTERN_TOKENS.has(pitch as PitchPattern)
		&& next.presentField === "pitch"
	) {
		next.pitchPattern = pitch as PitchPattern;
	}

	return next;
}

// ─── Serialize ──────────────────────────────────────────────────────────

/**
 * Inverse of `parseFiltersFromURL`. Omits keys that hold the default value
 * so the URL stays short for unfiltered or lightly-filtered states.
 */
export function serializeFiltersToURL(state: CardsFilterState): URLSearchParams {
	const out = new URLSearchParams();
	if (state.search.length > 0)
		out.set("q", state.search);
	if (state.deckId !== "all")
		out.set("deck", state.deckId);
	if (state.jlpt !== "all")
		out.set("jlpt", state.jlpt);
	if (state.status !== "all")
		out.set("status", state.status);
	if (state.sort !== "recent")
		out.set("sort", state.sort);
	// Only serialize `dir` when it diverges from the natural default for
	// the resolved sort axis. Keeps the URL short for the common case.
	if (state.sortDir !== null && state.sortDir !== naturalSortDirFor(state.sort)) {
		out.set("dir", state.sortDir);
	}
	if (state.viewId !== null)
		out.set("view", state.viewId);
	if (state.missingField !== null)
		out.set("missing", state.missingField);
	if (state.presentField !== null)
		out.set("present", state.presentField);
	if (state.pitchPattern !== null && state.presentField === "pitch") {
		out.set("pitch", state.pitchPattern);
	}
	// Page 1 is the implicit default; omit from URL for clean links.
	if (state.page > 1) {
		out.set("page", String(state.page));
	}
	return out;
}

// ─── View merging ───────────────────────────────────────────────────────

/**
 * Apply a saved view's recipe over a base state. The view supplies
 * defaults; the base wins for any dimension that diverges from the view's
 * default. This implements the "URL wins over view recipe" precedence
 * from the design brief.
 *
 * Use case: when the user picks a view, we hydrate state from the recipe
 * but preserve any explicit override already encoded in the URL.
 */
export function mergeViewRecipe(
	base: CardsFilterState,
	recipe: SavedViewRecipe,
): CardsFilterState {
	const next: CardsFilterState = { ...base };
	if (recipe.search !== undefined && base.search.length === 0)
		next.search = recipe.search;
	if (recipe.jlptLevel !== undefined && base.jlpt === "all")
		next.jlpt = recipe.jlptLevel;
	if (recipe.status !== undefined && base.status === "all")
		next.status = recipe.status;
	if (recipe.sort !== undefined && base.sort === "recent")
		next.sort = recipe.sort;
	if (recipe.missingField !== undefined && base.missingField === null)
		next.missingField = recipe.missingField;
	if (recipe.presentField !== undefined && base.presentField === null)
		next.presentField = recipe.presentField;
	if (
		recipe.pitchPattern !== undefined
		&& next.presentField === "pitch"
		&& base.pitchPattern === null
	) {
		next.pitchPattern = recipe.pitchPattern;
	}
	return next;
}

/**
 * True when the live state matches the view's recipe exactly on every
 * dimension the recipe defines. Used to render the "modified" dot on the
 * view dropdown when the user has overridden any axis of the active view.
 */
export function stateMatchesRecipe(
	state: CardsFilterState,
	recipe: SavedViewRecipe,
): boolean {
	if (recipe.search !== undefined && recipe.search !== state.search)
		return false;
	if (recipe.jlptLevel !== undefined && recipe.jlptLevel !== state.jlpt)
		return false;
	if (recipe.status !== undefined && recipe.status !== state.status)
		return false;
	if (recipe.sort !== undefined && recipe.sort !== state.sort)
		return false;
	if (recipe.missingField !== undefined && recipe.missingField !== state.missingField)
		return false;
	if (recipe.presentField !== undefined && recipe.presentField !== state.presentField)
		return false;
	if (recipe.pitchPattern !== undefined && recipe.pitchPattern !== state.pitchPattern)
		return false;
	return true;
}

// ─── Chip projection ────────────────────────────────────────────────────

/**
 * The list of dimensions that surface as removable chips. Search, sort,
 * deck, and view aren't chip-ified: search has its own input, sort lives
 * in the toolbar as a dropdown, deck and view anchor the toolbar's left
 * side. Status, JLPT, and the presence dimensions become chips because
 * those are the axes that read as "currently narrowed by …".
 */
export type ChipDimension
	= | "jlpt"
		| "status"
		| "missing"
		| "present"
		| "pitchPattern";

export interface FilterChip {
	dim: ChipDimension;
	/** Token-level value, e.g. 'N3', 'review', 'pitch'. */
	value: string;
	/** Human-readable label shown on the chip, e.g. 'JLPT N3'. */
	label: string;
}

/**
 * Project filter state into the chip strip's display model. The order
 * here drives the visual order of chips, chosen to read left-to-right
 * from broadest (scope) to most specific (quality).
 */
export function chipsFromState(state: CardsFilterState): FilterChip[] {
	const chips: FilterChip[] = [];

	if (state.jlpt !== "all") {
		chips.push({
			dim: "jlpt",
			value: state.jlpt,
			label: state.jlpt === "beyond" ? "Beyond JLPT" : `JLPT ${state.jlpt}`,
		});
	}

	if (state.status !== "all") {
		const cap = state.status.charAt(0).toUpperCase() + state.status.slice(1);
		chips.push({ dim: "status", value: state.status, label: cap });
	}

	if (state.missingField !== null) {
		chips.push({
			dim: "missing",
			value: state.missingField,
			label: `Missing ${state.missingField}`,
		});
	}

	if (state.presentField !== null) {
		chips.push({
			dim: "present",
			value: state.presentField,
			label: `Has ${state.presentField}`,
		});
	}

	if (state.pitchPattern !== null && state.presentField === "pitch") {
		chips.push({
			dim: "pitchPattern",
			value: state.pitchPattern,
			label: `Pattern: ${state.pitchPattern}`,
		});
	}

	return chips;
}

/**
 * Drop a chip dimension. Has a side effect on pitchPattern when present
 * is cleared, mirroring the backend invariant that pattern requires
 * present=pitch.
 */
export function clearChip(state: CardsFilterState, dim: ChipDimension): CardsFilterState {
	switch (dim) {
		case "jlpt": return { ...state, jlpt: "all" };
		case "status": return { ...state, status: "all" };
		case "missing": return { ...state, missingField: null };
		case "present": return { ...state, presentField: null, pitchPattern: null };
		case "pitchPattern": return { ...state, pitchPattern: null };
		default: return assertNever(dim);
	}
}

/** True when at least one chip-worthy dimension is non-default. */
export function hasAnyChip(state: CardsFilterState): boolean {
	return state.jlpt !== "all"
		|| state.status !== "all"
		|| state.missingField !== null
		|| state.presentField !== null
		|| state.pitchPattern !== null;
}

/** True when the state has any narrowing applied at all (chips OR search). */
export function hasAnyFilter(state: CardsFilterState): boolean {
	return state.search.length > 0 || hasAnyChip(state) || state.viewId !== null;
}
