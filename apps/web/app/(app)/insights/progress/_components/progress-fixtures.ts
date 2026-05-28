import type { HeatmapCell, JlptCoverage, MatureMilestone, MaturePoint, ProgressData, RetentionPoint } from "./progress-types";
import {
	JLPT_TOTALS,

} from "./progress-types";

/**
 * Progress fixtures. Four narrative states the page is designed for:
 * strong (memory holding, mature growing), plateau (flat curve, slow
 * accumulation), declining (retention slipping), and limited (under
 * the 14-day threshold).
 *
 * Numbers are realistic for a mid-progress JLPT N3 learner. The
 * "TODAY_ISO" anchor matches the Statistics fixtures so screenshots
 * across the two pages stay coherent.
 */

const TODAY_ISO = "2026-05-17";

function parseIso(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

function isoFromDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
	const d = parseIso(iso);
	d.setUTCDate(d.getUTCDate() + n);
	return isoFromDate(d);
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t = (t + 0x6D2B79F5) >>> 0;
		let x = t;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

// ── Heatmap (365 days) ─────────────────────────────────────────────────────

interface HeatmapParams {
	seed: number;
	daysActive: number;
	meanRetention: number;
	meanCount: number;
	weekendDip: number;
}

function buildHeatmap(p: HeatmapParams): HeatmapCell[] {
	const rng = mulberry32(p.seed);
	const out: HeatmapCell[] = [];
	for (let i = 365 - 1; i >= 0; i -= 1) {
		const date = addDays(TODAY_ISO, -i);
		const dow = (parseIso(date).getUTCDay() + 6) % 7;
		const recency = (365 - i) / 365;
		const weekendMul = dow >= 5 ? p.weekendDip : 1.0;
		const noise = rng();
		const activeChance = clamp(0.40 + recency * 0.50, 0, 0.95) * weekendMul;
		const active = noise < activeChance && i < p.daysActive;
		if (!active) {
			out.push({ date, count: 0, retention: 0 });
			continue;
		}
		const count = Math.round(p.meanCount * (0.55 + rng() * 0.9) * (0.7 + recency * 0.5));
		const retention = clamp(p.meanRetention + (rng() - 0.5) * 0.12, 0.6, 0.99);
		out.push({ date, count, retention });
	}
	return out;
}

// ── Retention series (90 days for the chart) ──────────────────────────────

function heatmapToRetention(heat: ReadonlyArray<HeatmapCell>, days: number): RetentionPoint[] {
	return heat.slice(-days).map(d => ({
		date: d.date,
		retention: d.count > 0 ? d.retention : null,
		reviews: d.count,
	}));
}

// ── Mature pipeline series ────────────────────────────────────────────────

interface MatureParams {
	seed: number;
	days: number;
	endMature: number;
	endYoung: number;
	endLearning: number;
	endNew: number;
	/** Growth rate of the pipeline; 1.0 = linear, <1 = slowing, >1 = accelerating. */
	shape: number;
}

function buildMatureSeries(p: MatureParams): MaturePoint[] {
	const rng = mulberry32(p.seed);
	const out: MaturePoint[] = [];
	for (let i = p.days - 1; i >= 0; i -= 1) {
		const date = addDays(TODAY_ISO, -i);
		const t = (p.days - i) / p.days; // 0 → 1 across the window
		const shaped = t ** p.shape;
		// New/learning oscillate around their end values; young + mature grow.
		const newCards = Math.round(p.endNew * (0.6 + rng() * 0.8));
		const learningCards = Math.round(p.endLearning * (0.6 + rng() * 0.8));
		const youngCards = Math.round(p.endYoung * (0.15 + shaped * 0.85) * (0.92 + rng() * 0.16));
		const matureCards = Math.round(p.endMature * shaped * (0.92 + rng() * 0.16));
		out.push({ date, new: newCards, learning: learningCards, young: youngCards, mature: matureCards });
	}
	return out;
}

function deriveMilestones(series: ReadonlyArray<MaturePoint>): MatureMilestone[] {
	const thresholds = [100, 250, 500, 1000, 2500, 5000] as const;
	const hits: MatureMilestone[] = [];
	for (const threshold of thresholds) {
		const hit = series.find(p => p.mature >= threshold);
		if (hit !== undefined)
			hits.push({ count: threshold, date: hit.date });
	}
	return hits;
}

// ── JLPT coverage ─────────────────────────────────────────────────────────

function buildJlpt(weights: ReadonlyArray<[number, number]>): JlptCoverage[] {
	const levels: Array<keyof typeof JLPT_TOTALS> = ["N5", "N4", "N3", "N2", "N1"];
	return levels.map((level, i) => {
		const w = weights[i] ?? [0, 0];
		const total = JLPT_TOTALS[level];
		const encountered = Math.round(total * w[0]);
		const owned = Math.round(total * w[1]);
		return { level, total, encountered, owned };
	});
}

// ── State ─────────────────────────────────────────────────────────────────

/** Mid-progress N3 learner; memory holding, pipeline filling. */
export function buildStrongFixture(): ProgressData {
	const heatmap = buildHeatmap({
		seed: 7,
		daysActive: 365,
		meanRetention: 0.89,
		meanCount: 32,
		weekendDip: 0.82,
	});
	const mature = buildMatureSeries({
		seed: 13,
		days: 365,
		endNew: 142,
		endLearning: 84,
		endYoung: 382,
		endMature: 624,
		shape: 1.4,
	});
	return {
		state: "strong",
		summary: {
			matureCount: 624,
			retention30d: 0.89,
			activeDaysLast30: 24,
			cardsAddedThisMonth: 84,
			daysSinceStart: 365,
		},
		retention: heatmapToRetention(heatmap, 90),
		mature,
		milestones: deriveMilestones(mature),
		jlpt: buildJlpt([
			[0.96, 0.78],
			[0.82, 0.58],
			[0.58, 0.32],
			[0.18, 0.06],
			[0.04, 0.01],
		]),
		heatmap,
		desiredRetention: 0.90,
	};
}

/** Same learner, but retention and pipeline are flat for the past 30d. */
export function buildPlateauFixture(): ProgressData {
	const base = buildStrongFixture();
	// Flatten the last 30 days of mature growth.
	const mature: MaturePoint[] = base.mature.map((p, i, arr) => {
		if (i < arr.length - 30)
			return p;
		const anchor = arr[arr.length - 30];
		if (anchor === undefined)
			return p;
		return { ...p, mature: anchor.mature, young: anchor.young };
	});
	const retention: RetentionPoint[] = base.retention.map(p =>
		p.retention !== null && p.reviews > 0
			? { ...p, retention: clamp(0.89 + (p.retention - 0.89) * 0.25, 0.85, 0.92) }
			: p,
	);
	return {
		...base,
		state: "plateau",
		mature,
		milestones: deriveMilestones(mature),
		retention,
		summary: { ...base.summary, cardsAddedThisMonth: 18, activeDaysLast30: 22 },
	};
}

/** Retention slipping over the past 21 days. */
export function buildDecliningFixture(): ProgressData {
	const base = buildStrongFixture();
	const retention: RetentionPoint[] = base.retention.map((p, i, arr) => {
		if (p.retention === null)
			return p;
		const fromEnd = arr.length - 1 - i;
		if (fromEnd > 21)
			return p;
		const drop = (21 - fromEnd) / 21 * 0.08;
		return { ...p, retention: clamp(p.retention - drop, 0.6, 0.99) };
	});
	return {
		...base,
		state: "declining",
		retention,
		summary: { ...base.summary, retention30d: 0.83 },
	};
}

/** New user: only 9 days of history. Triggers the empty state. */
export function buildLimitedFixture(): ProgressData {
	const heatmap = buildHeatmap({
		seed: 31,
		daysActive: 9,
		meanRetention: 0.86,
		meanCount: 14,
		weekendDip: 0.95,
	});
	const mature = buildMatureSeries({
		seed: 41,
		days: 9,
		endNew: 38,
		endLearning: 12,
		endYoung: 4,
		endMature: 0,
		shape: 1.0,
	});
	return {
		state: "limited",
		summary: {
			matureCount: 0,
			retention30d: 0.86,
			activeDaysLast30: 8,
			cardsAddedThisMonth: 54,
			daysSinceStart: 9,
		},
		retention: heatmapToRetention(heatmap, 9),
		mature,
		milestones: [],
		jlpt: buildJlpt([
			[0.06, 0.00],
			[0.00, 0.00],
			[0.00, 0.00],
			[0.00, 0.00],
			[0.00, 0.00],
		]),
		heatmap,
		desiredRetention: 0.90,
	};
}
