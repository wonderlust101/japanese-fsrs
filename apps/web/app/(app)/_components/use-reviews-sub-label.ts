"use client";

import { useDueCards } from "@/lib/api/reviews";

/**
 * Time estimate for the Reviews row subLabel. 0.5 min per card (30 sec) is a
 * conservative average across modalities; can be replaced with a per-user
 * FSRS-derived estimate later. The minimum-of-1 clamp keeps the estimate from
 * reading "0 min" when the due count is small.
 */
const MIN_PER_CARD = 0.5;

/**
 * Microcopy for the Reviews nav row's second line, shared by the desktop
 * Sidebar and the MobileDrawer so the two never drift.
 *
 * Returns a string in EVERY state — never `undefined` — so the Reviews row is
 * always two-line and the nav rows below it never shift as `useDueCards`
 * resolves. The earlier behavior returned `undefined` while pending/errored,
 * which rendered a shorter one-line row that grew (pushing the nav down) once
 * the count arrived. The four states:
 *   - has due cards → "12 cards · ~6 min"
 *   - settled at 0  → "No reviews available"  (empty state)
 *   - still loading → "Checking for reviews…" (loading state)
 *   - failed        → "Couldn't load count"   (non-misleading; reserves height)
 */
export function useReviewsSubLabel(): string {
	const dueCardsQuery = useDueCards();
	const dueCount = dueCardsQuery.data?.items.length ?? 0;

	if (dueCount > 0) {
		const minutes = Math.max(1, Math.ceil(dueCount * MIN_PER_CARD));
		return `${dueCount} card${dueCount === 1 ? "" : "s"} · ~${minutes} min`;
	}
	if (dueCardsQuery.isSuccess)
		return "No reviews available";
	if (dueCardsQuery.isError)
		return "Couldn't load count";
	return "Checking for reviews…";
}
