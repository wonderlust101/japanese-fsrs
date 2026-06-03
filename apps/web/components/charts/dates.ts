/**
 * Date and axis helpers shared by the forecast charts (and available to any
 * other Insights chart that plots a forward day series). These were copy-pasted
 * verbatim across `ForecastWorkloadChart` and `NewCardImpactCard`; centralizing
 * them keeps the two charts' day math provably identical and removes the drift
 * risk of two independent copies.
 *
 * All dates are handled in UTC so a learner's local midnight never shifts a
 * bar into the wrong column. ISO strings are the canonical `YYYY-MM-DD` form.
 */

/** Parse a `YYYY-MM-DD` ISO date as UTC midnight. */
export function parseIso(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

/** Format a Date back to its `YYYY-MM-DD` ISO day. */
export function isoFromDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Add `n` whole days to an ISO day, returning a new ISO day. */
export function addDays(iso: string, n: number): string {
	const d = parseIso(iso);
	d.setUTCDate(d.getUTCDate() + n);
	return isoFromDate(d);
}

/** Single-letter weekday (Monday-first), e.g. `M T W T F S S`. */
export function dayLetter(iso: string): string {
	const dow = (parseIso(iso).getUTCDay() + 6) % 7;
	return ["M", "T", "W", "T", "F", "S", "S"][dow] as string;
}

/** Day-of-month with the leading zero stripped, e.g. `01` -> `1`. */
export function dayOfMonth(iso: string): string {
	return iso.slice(8, 10).replace(/^0/, "");
}

/**
 * True when the ISO day falls on a Sunday (Monday-first week). Used to gate
 *  the date sub-label so only week boundaries print a number.
 */
export function isWeekEnd(iso: string): boolean {
	return (parseIso(iso).getUTCDay() + 6) % 7 === 6;
}

/** Format an ISO day as a short `Mon D` label (e.g. `Jun 2`), in UTC. */
export function formatDateShort(iso: string): string {
	return parseIso(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Horizontal text anchor for an axis tick. */
export type XAnchor = "start" | "middle" | "end";

/** A single x-axis tick: which series index it sits on, its label, and anchor. */
export interface XTick {
	index: number;
	label: string;
	anchor: XAnchor;
}

/**
 * Pick up to `want` evenly-spaced x-axis ticks across a date series. The first
 * tick anchors `start` (its label extends rightward from the left edge instead
 * of being clipped); the last anchors `end` (so the rightmost/"today" label is
 * never cropped past the viewBox); interior ticks use `middle`. Duplicate
 * rounded indices are de-duped, so short series yield fewer than `want` ticks.
 *
 * Centralized here because `MatureStackedArea` and `RetentionRibbonChart`
 * carried byte-identical copies; sharing one implementation keeps their x-axis
 * provably aligned (both render on the same date series, side by side).
 */
export function pickXTicks(dates: ReadonlyArray<string>, want: number): XTick[] {
	if (dates.length === 0)
		return [];
	if (dates.length === 1) {
		const only = dates[0];
		if (only === undefined)
			return [];
		return [{ index: 0, label: formatDateShort(only), anchor: "middle" }];
	}
	const lastIdx = dates.length - 1;
	const tickCount = Math.max(2, Math.min(want, dates.length));
	const out: XTick[] = [];
	const seen = new Set<number>();
	for (let i = 0; i < tickCount; i += 1) {
		const idx = Math.round((i / (tickCount - 1)) * lastIdx);
		if (seen.has(idx))
			continue;
		seen.add(idx);
		const d = dates[idx];
		if (d === undefined)
			continue;
		const anchor: XAnchor = idx === 0 ? "start" : idx === lastIdx ? "end" : "middle";
		out.push({ index: idx, label: formatDateShort(d), anchor });
	}
	return out;
}

/**
 * Round a max value up to a "nice" axis ceiling so gridlines land on readable
 * numbers (5, 10, 25, 50, 100, 200, 500, then multiples of 250).
 */
export function niceCeil(n: number): number {
	if (n <= 5)
		return 5;
	if (n <= 10)
		return 10;
	if (n <= 25)
		return 25;
	if (n <= 50)
		return 50;
	if (n <= 100)
		return 100;
	if (n <= 200)
		return 200;
	if (n <= 500)
		return 500;
	return Math.ceil(n / 250) * 250;
}
