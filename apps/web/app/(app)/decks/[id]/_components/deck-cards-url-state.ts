// URL-canonical filter state for the deck-detail card list (status / search /
// sort / page) and the status label map. Lifted out of deck-detail-view.tsx.

import type { CardSortDir, CardSortField } from "@fsrs-japanese/shared-types";

import type { StatusFilter } from "./deck-card-toolbar";

export const STATUS_LABEL: Record<StatusFilter, string> = {
	all: "All",
	new: "New",
	learning: "Learning",
	review: "Review",
	suspended: "Suspended",
};

// ── URL-canonical filter state ──────────────────────────────────────────
// Three deep-linkable params on the deck route: `status`, `q` (search), and
// `page` (1-indexed). Defaults (All / empty / page 1) are omitted from the URL
// so a clean deck link stays clean. `pageSize` is intentionally absent — it's
// a viewing preference held in local state, matching cards-browser-view.

export interface DeckCardsUrlState {
	status: StatusFilter;
	search: string;
	/** Sort axis. Default 'recent' (newest added first). */
	sort: CardSortField;
	/** Explicit direction override, or null to mean "the axis's natural default." */
	sortDir: CardSortDir | null;
	page: number;
}

const STATUS_VALUES: readonly StatusFilter[] = ["all", "new", "learning", "review", "suspended"];
const SORT_VALUES: readonly CardSortField[] = ["recent", "due", "lapses"];
const DEFAULT_SORT: CardSortField = "recent";

export function parseDeckCardsUrl(get: (key: string) => string | null): DeckCardsUrlState {
	const rawStatus = get("status");
	const status = rawStatus !== null && (STATUS_VALUES as readonly string[]).includes(rawStatus)
		? (rawStatus as StatusFilter)
		: "all";

	const search = get("q") ?? "";

	const rawSort = get("sort");
	const sort = rawSort !== null && (SORT_VALUES as readonly string[]).includes(rawSort)
		? (rawSort as CardSortField)
		: DEFAULT_SORT;

	const rawDir = get("dir");
	const sortDir: CardSortDir | null = rawDir === "asc" || rawDir === "desc" ? rawDir : null;

	const rawPage = Number(get("page"));
	const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

	return { status, search, sort, sortDir, page };
}

export function serializeDeckCardsUrl(state: DeckCardsUrlState): URLSearchParams {
	const params = new URLSearchParams();
	if (state.status !== "all")
		params.set("status", state.status);
	if (state.search.trim().length > 0)
		params.set("q", state.search);
	if (state.sort !== DEFAULT_SORT)
		params.set("sort", state.sort);
	if (state.sortDir !== null)
		params.set("dir", state.sortDir);
	if (state.page > 1)
		params.set("page", String(state.page));
	return params;
}
