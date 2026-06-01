import type { ApiForecastDay } from "@fsrs-japanese/shared-types";

import { SectionCard } from "@/components/ui/SectionCard";
import { StatTile } from "@/components/ui/StatTile";

import { estimateSessionFromCounts } from "@/lib/review/estimate-time";

interface TimeEstimateCardProps {
	forecast: ReadonlyArray<ApiForecastDay>;
}

interface Estimate {
	cards: number;
	seconds: number;
	label: string;
}

function sortAsc(xs: ReadonlyArray<ApiForecastDay>): ApiForecastDay[] {
	return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Formats a session length using the same pace targets as Review Setup
 * (new = 25s, review/learning/relearning = 20/15s averages from
 * `lib/review/estimate-time.ts`). Short windows (≤ 90 min) render as
 * "≈ N min"; longer windows render as "≈ N hr Mmin" with mixed units.
 * Always uses the "≈" prefix so the estimate reads as honest fuzziness,
 * not false precision.
 */
function formatSpan(totalSeconds: number): string {
	if (totalSeconds <= 0)
		return "0 min";
	if (totalSeconds < 60)
		return "under a minute";
	const minutes = Math.round(totalSeconds / 60);
	if (minutes < 90)
		return `≈ ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rem = minutes - hours * 60;
	return rem === 0 ? `≈ ${hours} hr` : `≈ ${hours} hr ${rem} min`;
}

function estimateFor(days: ReadonlyArray<ApiForecastDay>): Estimate {
	let cards = 0;
	let newCount = 0;
	let reviewCount = 0;
	for (const d of days) {
		cards += d.count;
		newCount += d.newCount;
		reviewCount += d.reviewCount + d.backlogCount;
	}
	const seconds = estimateSessionFromCounts({ newCount, reviewCount });
	return { cards, seconds, label: formatSpan(seconds) };
}

/**
 * Two-line time estimate for "tomorrow" and "this week," computed from
 * the forecast's `newCount` and `reviewCount` using the same pace targets
 * Review Setup uses. The numbers are honest estimates, prefixed with `≈`.
 */
export function TimeEstimateCard({
	forecast,
}: TimeEstimateCardProps): React.JSX.Element {
	const ordered = sortAsc(forecast);
	const tomorrow = ordered[1] ?? ordered[0];
	const tomorrowEst = tomorrow ? estimateFor([tomorrow]) : null;
	const weekEst = estimateFor(ordered.slice(0, 7));

	return (
		<SectionCard
			kanji="時"
			label="Time estimate"
			description="At a steady review pace, here's roughly how much sitting time the next few days ask for."
			reveal
		>
			<dl className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-0">
				<EstimateRow
					term="Tomorrow"
					estimate={tomorrowEst}
				/>
				<EstimateRow
					term="This week"
					estimate={weekEst}
				/>
			</dl>
		</SectionCard>
	);
}

function EstimateRow({
	term,
	estimate,
}: {
	term: string;
	estimate: Estimate | null;
}): React.JSX.Element {
	const trailing = estimate !== null && estimate.cards > 0
		? `· ${estimate.cards} ${estimate.cards === 1 ? "card" : "cards"}`
		: undefined;
	return (
		<StatTile
			label={term}
			value={estimate === null ? "—" : estimate.label}
			{...(trailing !== undefined && { trailing })}
		/>
	);
}
