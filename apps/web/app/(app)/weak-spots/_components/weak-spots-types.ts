import type {
	WeakSpotDiagnosisFilter,
	WeakSpotSortOrder,
	WeakSpotStatusFilter,
} from "@/lib/actions/weak-spots.actions";

/**
 * Feature flag: weak-spot drilling is out of the MVP scope but kept intact for
 * the next rollout. While `false`, every Drill entry point (the header CTA,
 * the per-row Drill button, and the detail dialog's "Drill this card") is
 * hidden; the `/weak-spots/drill/*` routes and their components stay in the
 * codebase. Flip to `true` to surface drilling again.
 */
export const WEAK_SPOT_DRILL_ENABLED: boolean = false;

/**
 * UI-side filter shape. `'all'` is the wire-absent value for each column-
 * style dropdown — translated to "omit param" at the API layer in
 * `weakSpots-view.tsx` before calling `useWeakSpotsQuery`.
 *
 * Kept independent of the wire types so the dropdowns can render a uniform
 * "All ___" option without each filter dropdown needing its own union with
 * `undefined`.
 */
export interface WeakSpotFilters {
	status: WeakSpotStatusFilter;
	deckId: string | "all";
	jlptLevel: string | "all";
	diagnosis: WeakSpotDiagnosisFilter | "all";
	sort: WeakSpotSortOrder;
	/** Direction override for `sort`; `null` uses the mode's natural default. */
	sortDir: "asc" | "desc" | null;
	/** Free-text query. Empty string means "no search". */
	search: string;
}

export const INITIAL_WEAK_SPOT_FILTERS: WeakSpotFilters = {
	status: "unresolved",
	deckId: "all",
	jlptLevel: "all",
	diagnosis: "all",
	sort: "mostRecent",
	sortDir: null,
	search: "",
};
