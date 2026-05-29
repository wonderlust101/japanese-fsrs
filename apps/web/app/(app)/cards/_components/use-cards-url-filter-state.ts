import type { CardsFilterState } from "./cards-filter-state";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	DEFAULT_FILTER_STATE,
	hasAnyFilter,
	mergeViewRecipe,
	parseFiltersFromURL,
	serializeFiltersToURL,
} from "./cards-filter-state";
import { findViewById, useSavedViewPersistence } from "./saved-views-storage";

export interface CardsUrlFilterState {
	/** Filter state derived from the URL — the single source of truth. */
	state: CardsFilterState;
	/**
	 * Push a new filter state into the URL. Auto-resets to page 1 whenever any
	 * field other than `page` changed (page-nav handlers pass through `page` only).
	 */
	updateState: (next: CardsFilterState) => void;
	handleSearchChange: (nextSearch: string) => void;
	handlePickView: (nextViewId: string | null) => void;
	handleClearAll: () => void;
}

/**
 * URL-canonical filter state for the cards browser.
 *
 * The URL is the single source of truth. Filter state is DERIVED from
 * `searchParams` via useMemo, not stored in a separate React state.
 * Previously we kept both a local useState and a useEffect that re-parsed
 * from URL on change — that pattern raced with `router.replace()` and caused
 * symptoms like "sort dropdown changes visually but table doesn't refetch
 * until you reload." With a single source, the chain is: user picks sort →
 * router.replace → searchParams updates → useMemo recomputes → queryOpts
 * recomputes → TanStack refetches. No race, no dual write.
 */
export function useCardsUrlFilterState(): CardsUrlFilterState {
	const router = useRouter();
	const searchParams = useSearchParams();

	const state = useMemo<CardsFilterState>(
		() => parseFiltersFromURL(k => searchParams.get(k)),
		[searchParams],
	);

	// Persist last-picked view id so a cold visit lands on the user's
	// preferred starting point when the URL is otherwise clean.
	const { remember: rememberView, lastActiveId } = useSavedViewPersistence();
	const hydratedOnceRef = useRef(false);
	useEffect(() => {
		if (hydratedOnceRef.current)
			return;
		hydratedOnceRef.current = true;
		if (state.viewId !== null)
			return;
		if (lastActiveId === null)
			return;
		if (hasAnyFilter(state))
			return; // user already filtered via URL
		const view = findViewById(lastActiveId);
		if (view === undefined)
			return;
		// Push the persisted view into the URL on hydration so the URL
		// remains the canonical state source. Avoids the previous
		// setState-based approach which fought the URL-derived state.
		const next = mergeViewRecipe({ ...state, viewId: view.id }, view.recipe);
		const params = serializeFiltersToURL(next);
		const qs = params.toString();
		router.replace(qs.length > 0 ? `/cards?${qs}` : "/cards", { scroll: false });
	}, [lastActiveId, state, router]);

	const updateState = useCallback((next: CardsFilterState) => {
		// Auto-reset to page 1 whenever any field OTHER than `page`
		// changed. Filter children (toolbar pickers, chip editors) call
		// updateState with `{ ...state, jlpt: 'N3' }` patterns and would
		// otherwise keep the user pinned on a stale page index that
		// doesn't make sense against the new result set. Page-navigation
		// handlers (handlePrev/Next/PickPage) explicitly change ONLY
		// `page` and pass through unchanged.
		const onlyPageChanged
			= next.search === state.search
				&& next.deckId === state.deckId
				&& next.jlpt === state.jlpt
				&& next.status === state.status
				&& next.sort === state.sort
				&& next.sortDir === state.sortDir
				&& next.viewId === state.viewId
				&& next.missingField === state.missingField
				&& next.presentField === state.presentField
				&& next.pitchPattern === state.pitchPattern;
		const finalNext: CardsFilterState = onlyPageChanged ? next : { ...next, page: 1 };
		// Update via the URL — searchParams change triggers the useMemo
		// above, which re-derives `state`. No local React state to keep
		// in sync separately. Single source of truth.
		const params = serializeFiltersToURL(finalNext);
		const qs = params.toString();
		router.replace(qs.length > 0 ? `/cards?${qs}` : "/cards", { scroll: false });
	}, [state, router]);

	const handleSearchChange = useCallback((nextSearch: string) => {
		updateState({ ...state, search: nextSearch });
	}, [state, updateState]);

	const handlePickView = useCallback((nextViewId: string | null) => {
		const view = findViewById(nextViewId);
		rememberView(nextViewId);
		if (view === undefined) {
			updateState({ ...DEFAULT_FILTER_STATE });
			return;
		}
		// Picking a view resets all dimensions to the view's defaults so
		// moving between views feels like a clean transition rather than
		// accreting filters across them. Search is preserved if the user
		// already typed something on the previous view.
		const seed: CardsFilterState = {
			...DEFAULT_FILTER_STATE,
			search: state.search,
			viewId: view.id,
		};
		updateState(mergeViewRecipe(seed, view.recipe));
	}, [state.search, updateState, rememberView]);

	const handleClearAll = useCallback(() => {
		rememberView(null);
		updateState({ ...DEFAULT_FILTER_STATE });
	}, [updateState, rememberView]);

	return { state, updateState, handleSearchChange, handlePickView, handleClearAll };
}
