/**
 * Shared time-range vocabulary for the Progress page. A single range drives
 * every time-series chart (Retention, Mature) so the two never disagree on
 * what window the learner is looking at. The control lives in the Retention
 * card header; the Mature card echoes the active range read-only.
 *
 * `days = null` means "all available history" — charts render their full
 * series and simply cap at whatever window they actually have.
 */
export type ProgressRangeKey = "7d" | "30d" | "90d" | "1y" | "all";

export const PROGRESS_RANGES: ReadonlyArray<{
	key: ProgressRangeKey;
	label: string;
	days: number | null;
}> = [
	{ key: "7d", label: "7d", days: 7 },
	{ key: "30d", label: "30d", days: 30 },
	{ key: "90d", label: "90d", days: 90 },
	{ key: "1y", label: "1y", days: 365 },
	{ key: "all", label: "All", days: null },
];

/** Default window: wide enough that both charts show a meaningful shape. */
export const DEFAULT_PROGRESS_RANGE: ProgressRangeKey = "90d";

export function rangeDays(key: ProgressRangeKey): number | null {
	return PROGRESS_RANGES.find(r => r.key === key)?.days ?? null;
}

export function rangeLabel(key: ProgressRangeKey): string {
	return PROGRESS_RANGES.find(r => r.key === key)?.label ?? key;
}
