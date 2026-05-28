import type { ProgressData, ProgressState } from "./progressTypes";

/**
 * Interpretation builders for the Progress page. The brief asks every
 * chart to pair with a single plain-language read; these helpers turn
 * raw data into those one-liner sentences and keep the wording
 * consistent across states.
 *
 * Voice rules: editorial, specific, no em-dashes, no cheerleading.
 * Numbers are woven into prose where it reads naturally; otherwise
 * left to the chart itself.
 */

function pct(n: number): string {
	return `${Math.round(n * 100)}%`;
}

function withCommas(n: number): string {
	return n.toLocaleString("en-US");
}

// ── Page state classification ──────────────────────────────────────────────

const LIMITED_THRESHOLD_DAYS = 14;

export function classifyProgress(data: Pick<ProgressData, "retention" | "mature" | "desiredRetention" | "summary">): ProgressState {
	const days = data.retention.length;
	if (days < LIMITED_THRESHOLD_DAYS)
		return "limited";

	const recent = data.retention.slice(-21).filter(p => p.retention !== null) as Array<{ retention: number }>;
	if (recent.length === 0)
		return "limited";

	const mean = recent.reduce((acc, p) => acc + p.retention, 0) / recent.length;
	if (mean < data.desiredRetention - 0.03)
		return "declining";

	const last30 = data.mature.slice(-30);
	if (last30.length >= 2) {
		const first = last30[0];
		const final = last30[last30.length - 1];
		if (first !== undefined && final !== undefined) {
			const growth = final.mature - first.mature;
			if (growth < 5)
				return "plateau";
		}
	}
	return "strong";
}

// ── Header italic line ─────────────────────────────────────────────────────

/**
 * Page header subtitle: the overall *state verdict*, in plain language. It
 * deliberately avoids leading with the retention percentage or restating the
 * mover, so the Summary line and the Retention chart each keep something to
 * say. Header = "how are things, broadly"; the cards below carry the numbers.
 */
export function buildHeaderLine(data: ProgressData): string {
	switch (data.state) {
		case "strong":
			return `Memory is holding, and your collection keeps maturing.`;
		case "plateau":
			return `Retention is steady, but mature growth has gone flat this month.`;
		case "declining":
			return `Retention has dipped below your target. Worth a closer look below.`;
		case "limited":
			return `Progress takes a beat to settle.`;
	}
}

// ── Retention interpretation ──────────────────────────────────────────────

export function buildRetentionLine(data: ProgressData): string {
	const recent = data.retention.slice(-30).filter(p => p.retention !== null) as Array<{ retention: number }>;
	if (recent.length === 0)
		return "Not enough reviews to read retention yet.";
	const mean = recent.reduce((acc, p) => acc + p.retention, 0) / recent.length;
	const target = data.desiredRetention;
	const delta = Math.round((mean - target) * 100);

	if (data.state === "declining") {
		return `Down ${Math.abs(delta)} points from your ${pct(target)} target. The Mistakes page will show which cards are slipping.`;
	}
	if (delta >= 0)
		return `Inside the everyday range and at or above your ${pct(target)} target.`;
	return `Within a couple points of your ${pct(target)} target, holding steady.`;
}

// ── Mature interpretation ─────────────────────────────────────────────────

export function buildMatureLine(data: ProgressData): string {
	const series = data.mature;
	if (series.length < 14)
		return "A few more weeks of practice will fill this chart.";
	const last = series[series.length - 1];
	const prev = series[Math.max(0, series.length - 8)];
	if (last === undefined || prev === undefined)
		return "";
	const matureDelta = last.mature - prev.mature;
	const youngWidth = last.young;

	if (data.state === "plateau") {
		return `Mature growth has slowed to ${matureDelta} cards in the past week. A small bump in new cards could help.`;
	}
	if (matureDelta >= 28) {
		return `${matureDelta} new mature cards this past week. The young layer (${withCommas(youngWidth)}) means more graduations are coming.`;
	}
	return `${matureDelta} cards moved into mature this past week, with ${withCommas(youngWidth)} more close behind.`;
}

// ── JLPT interpretation ───────────────────────────────────────────────────

export function buildJlptLine(data: ProgressData): string {
	const candidates = data.jlpt.filter(j => j.owned < j.total && j.encountered > 0);
	if (candidates.length === 0)
		return "JLPT coverage starts once cards are mapped to a level.";

	let closest = candidates[0];
	if (closest === undefined)
		return "";
	let bestScore = closest.owned / closest.total;
	for (const j of candidates) {
		const score = j.owned / j.total;
		if (score > bestScore) {
			closest = j;
			bestScore = score;
		}
	}
	if (closest === undefined)
		return "";
	return `Closest to finishing ${closest.level}. ${withCommas(closest.owned)} of ${withCommas(closest.total)} cards owned.`;
}

// ── Consistency interpretation ────────────────────────────────────────────

export function buildConsistencyLine(data: ProgressData): string {
	const days = data.heatmap.length;
	const active = data.heatmap.filter(d => d.count > 0).length;
	if (active === 0)
		return "No reviews logged yet.";
	return `Practiced on ${active} of the last ${days} days, with a steady cadence over the year.`;
}

// ── Summary interpretation ────────────────────────────────────────────────

/**
 * Summary strip line: leads with whichever signal *moved most* this month,
 * rather than always narrating retention (which the header verdict and the
 * Retention chart already cover). The lead is chosen by state and by the
 * mature-growth delta over the trailing ~30 snapshots, so the sentence
 * surfaces the thing actually worth the learner's attention right now.
 */
export function buildSummaryLine(data: ProgressData): string {
	const { summary } = data;
	if (data.state === "limited") {
		return `Early days. Once a couple more weeks of practice land, the chart shapes below will tell the story.`;
	}

	const series = data.mature;
	const matureDelta = series.length >= 2
		? (series[series.length - 1]?.mature ?? 0) - (series[Math.max(0, series.length - 30)]?.mature ?? 0)
		: 0;

	if (data.state === "declining") {
		return `The dip is recent; ${withCommas(summary.matureCount)} cards are still mature. Worth checking which ones are slipping.`;
	}
	if (data.state === "plateau") {
		return `Mature growth has nearly stalled this month. A few more new cards would get it moving again.`;
	}
	if (matureDelta >= 20) {
		return `Up ${withCommas(matureDelta)} mature cards this month, one of your strongest stretches yet.`;
	}
	if (summary.activeDaysLast30 >= 24) {
		return `You practiced ${summary.activeDaysLast30} of the last 30 days. Consistency is doing the quiet work.`;
	}
	return `A steady month: ${withCommas(summary.matureCount)} cards mature and retention near its target.`;
}

export { LIMITED_THRESHOLD_DAYS };
