import { KitsuneEmptyState } from "@/components/ui/KitsuneEmptyState";

import { LIMITED_THRESHOLD_DAYS } from "./progressInterpretation";

interface ProgressEmptyProps {
	/**
	 * Distinct days the learner has practiced so far (the heatmap returns one
	 * row per review-day), or null when no data has loaded yet. This is the
	 * exact quantity `classifyProgress` gates on, so the copy can count toward
	 * the real threshold rather than a calendar date.
	 */
	activeDays: number | null;
	/** Render the dev-flavored copy variant when we're previewing without data. */
	isDev?: boolean;
}

/**
 * Limited-data state for the Progress page. The IA brief names this as one of
 * the four real states; we honor it with the kitsune mark, a one-line read,
 * and an honest count toward the threshold that actually lifts the limited
 * state: {@link LIMITED_THRESHOLD_DAYS} distinct days of practice (see
 * `classifyProgress`).
 *
 * The earlier "come back around <date>" copy was removed: it projected
 * first-review + 14 *calendar* days, which drifts ahead of the real
 * practice-day gate the moment a learner skips a day (so the date could pass
 * while the page was still, correctly, limited).
 *
 * Deliberately no skeleton charts. The IA says "Set expectations about what
 * can be shown" — an honest count is better than a grey scaffold pretending
 * to load.
 */
export function ProgressEmpty({
	activeDays,
	isDev = false,
}: ProgressEmptyProps): React.JSX.Element {
	const body = isDev
		? "Limited-data fixture selected. After about two weeks of reviews, the page will fill with retention, mature growth, JLPT coverage, and cadence."
		: activeDays !== null && activeDays > 0
			? `You've practiced on ${activeDays} of the ${LIMITED_THRESHOLD_DAYS} days this page needs. Once you get there, it fills in with retention, mature growth, JLPT coverage, and cadence.`
			: `After about ${LIMITED_THRESHOLD_DAYS} days of practice, this page will show retention, mature growth, JLPT coverage, and cadence.`;

	return (
		<KitsuneEmptyState
			ariaLabel="Progress takes a beat to settle"
			headline="Progress takes a beat to settle."
			body={body}
			ctaHref="/today"
			ctaLabel="Start a review"
		/>
	);
}
