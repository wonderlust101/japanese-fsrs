// Report note / recommendation / headline builders. Each consumes the
// DerivedSignals and emits tone-tagged copy. Lifted out of weekly-report.ts.

import type { DerivedSignals } from "./weekly-report-signals";
import type { ReportHeadline, ReportNote, ReportRecommendation } from "./weekly-report-types";
import { loadCharacter, loadPhrase } from "./weekly-report-signals";

export function buildProgressNote(s: DerivedSignals): ReportNote {
	const base: Omit<ReportNote, "tone" | "body" | "severity"> = {
		kind: "progress",
		kanji: "保",
		label: "Retention",
		deepLink: { label: "See the full curve", href: "/insights/progress" },
		figure: "retention",
	};

	// Concerning drop.
	if (s.retentionDelta !== null && s.retentionDelta <= -0.08 && s.recent7 !== null) {
		const drop = Math.round(-s.retentionDelta * 100);
		const recentPct = Math.round(s.recent7 * 100);
		return {
			...base,
			tone: "attention",
			severity: 80,
			body: `Your retention has settled at *${recentPct}%* across the last seven active days — *${drop} points* below the trailing month. The slip is small but worth attending to before it widens.`,
		};
	}

	// Celebratory lift.
	if (s.retentionDelta !== null && s.retentionDelta >= 0.05 && s.recent7 !== null && s.recent7 >= 0.85) {
		const lift = Math.round(s.recent7 * 100);
		return {
			...base,
			tone: "celebratory",
			severity: 60,
			body: `Retention is holding at *${lift}%* this week — your strongest stretch in a month. Whatever rhythm you've found, keep it.`,
		};
	}

	// Steady stretch.
	if (s.recent7 !== null) {
		const recentPct = Math.round(s.recent7 * 100);
		if (s.trailing30 !== null) {
			const trailingPct = Math.round(s.trailing30 * 100);
			return {
				...base,
				tone: "neutral",
				severity: 30,
				body: `Retention sits at *${recentPct}%* this week, in line with your trailing month at ${trailingPct}%. Quiet and consistent.`,
			};
		}
		return {
			...base,
			tone: "neutral",
			severity: 25,
			body: `Retention is holding at *${recentPct}%* this week. The trailing month will fill in as the schedule compounds.`,
		};
	}

	// Not enough active days to read retention honestly.
	return {
		...base,
		tone: "neutral",
		severity: 10,
		body: `Retention will take shape after a few more active days. Until then, the curve stays quiet.`,
	};
}

export function buildMistakesNote(s: DerivedSignals): ReportNote {
	const base: Omit<ReportNote, "tone" | "body" | "severity"> = {
		kind: "mistakes",
		kanji: "弱",
		label: "Where you're slipping",
		deepLink: { label: "Open weak spots", href: "/weak-spots" },
		figure: "mistakes",
	};

	const a = s.accuracy;
	if (a === null) {
		return {
			...base,
			tone: "neutral",
			severity: 10,
			body: `Not enough reviews yet to read a pattern. It will take shape as you practice.`,
		};
	}

	const pct = Math.round(a.pct);

	if (pct < 65) {
		return {
			...base,
			tone: "attention",
			severity: 90,
			body: `Accuracy is *${pct}%* across ${a.total} reviews, so misses are running well over your 85% target. The chart marks each day that landed below the line; this is the most worthwhile place to spend a quiet ten minutes.`,
		};
	}
	if (pct < 75) {
		return {
			...base,
			tone: "attention",
			severity: 65,
			body: `Accuracy is *${pct}%* across ${a.total} reviews, a little over your 85% target. The days below the line in the chart are where a short repair pass would help most.`,
		};
	}
	if (pct < 85) {
		return {
			...base,
			tone: "neutral",
			severity: 30,
			body: `Accuracy is *${pct}%* across ${a.total} reviews, tracking close to your 85% target. Steady, with room to climb.`,
		};
	}
	return {
		...base,
		tone: "celebratory",
		severity: 15,
		body: `Accuracy is *${pct}%* across ${a.total} reviews. The chart tracks each day's misses against your 85% target; the collection is healthy.`,
	};
}

export function buildPlanningNote(s: DerivedSignals): ReportNote {
	const base: Omit<ReportNote, "tone" | "body" | "severity"> = {
		kind: "planning",
		kanji: "次",
		label: "The week ahead",
		deepLink: { label: "See your forecast", href: "/insights/forecast" },
		figure: "forecast",
	};

	const { weekTotal, tomorrow, peak, backlogPct } = s.forecast;
	const character = loadCharacter(weekTotal);
	const phrase = loadPhrase(character);

	if (backlogPct >= 0.25 && weekTotal > 0) {
		return {
			...base,
			tone: "attention",
			severity: 70,
			body: `*${Math.round(backlogPct * 100)}% of next week's load is backlog.* The forecast is dominated by overdue cards — clearing them first will make the rest feel lighter.`,
		};
	}
	if (character === "heavy") {
		return {
			...base,
			tone: "attention",
			severity: 55,
			body: `Next week looks like *${phrase}* — *${weekTotal} cards* scheduled, peaking at *${peak}* on one day. Consider easing the new-card pace until the queue settles.`,
		};
	}
	if (character === "light") {
		return {
			...base,
			tone: "celebratory",
			severity: 25,
			body: `Next week is *${phrase}* — *${weekTotal} cards* total, *${tomorrow}* tomorrow. Room to add new material if you'd like.`,
		};
	}
	return {
		...base,
		tone: "neutral",
		severity: 30,
		body: `Next week looks *${phrase}* — *${weekTotal} cards* scheduled, *${tomorrow}* tomorrow. Nothing to rearrange.`,
	};
}

// ── Recommendation builder ───────────────────────────────────────────────────

export function buildRecommendation(lead: ReportNote, s: DerivedSignals): ReportRecommendation {
	if (lead.kind === "mistakes" && lead.tone === "attention") {
		return {
			tone: "attention",
			kanji: "要",
			headline: "Spend ten quiet minutes on your slipping cards.",
			body: "A focused repair pass on what you're missing now lifts the whole average.",
			action: { label: "Drill weak spots", href: "/weak-spots" },
		};
	}
	if (lead.kind === "progress" && lead.tone === "attention") {
		return {
			tone: "attention",
			kanji: "要",
			headline: "Run today's review before adding anything new.",
			body: "When retention slips, the kindest move is to attend to what's already on the schedule.",
			action: { label: "Start today's review", href: "/today" },
		};
	}
	if (lead.kind === "planning" && lead.tone === "attention") {
		return {
			tone: "attention",
			kanji: "整",
			headline: "Clear the backlog before tomorrow's new cards.",
			body: "A short catch-up session today keeps the week from compounding.",
			action: { label: "Start a short session", href: "/today" },
		};
	}
	if (lead.tone === "celebratory") {
		return {
			tone: "celebratory",
			kanji: "続",
			headline: "Keep the rhythm. Tomorrow looks like a manageable day.",
		};
	}
	return {
		tone: "pacing",
		kanji: "今",
		headline: `Tomorrow's review is ${s.forecast.tomorrow} card${s.forecast.tomorrow === 1 ? "" : "s"} — a steady start.`,
	};
}

// ── Headline builder ─────────────────────────────────────────────────────────

function pickByDate<T>(seed: string, pool: ReadonlyArray<T>, fallback: T): T {
	if (pool.length === 0)
		return fallback;
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	return pool[hash % pool.length] ?? fallback;
}

export function buildHeadline(lead: ReportNote, s: DerivedSignals, seed: string): ReportHeadline {
	if (lead.kind === "progress" && lead.tone === "attention" && s.retentionDelta !== null) {
		const drop = Math.round(-s.retentionDelta * 100);
		return {
			tone: "attention",
			text: `Your retention slipped by *${drop} points* this week — small, but worth a closer look.`,
		};
	}
	if (lead.kind === "progress" && lead.tone === "celebratory" && s.recent7 !== null) {
		const lift = Math.round(s.recent7 * 100);
		return {
			tone: "celebratory",
			text: `Retention is holding at *${lift}%* this week — your strongest stretch in a month.`,
		};
	}
	if (lead.kind === "mistakes" && lead.tone === "attention" && s.accuracy !== null) {
		const pct = Math.round(s.accuracy.pct);
		return {
			tone: "attention",
			text: `Your reviews are landing at *${pct}%* — your softest stretch in a while.`,
		};
	}
	if (lead.kind === "planning" && lead.tone === "attention") {
		return {
			tone: "attention",
			text: `Next week is *${loadPhrase(loadCharacter(s.forecast.weekTotal))}* — *${s.forecast.weekTotal} cards* scheduled.`,
		};
	}
	// Neutral / celebratory date-rotated fallbacks.
	const lines: ReadonlyArray<string> = [
		`*${s.activeDayCount} sessions* in the books. The schedule keeps moving while you do.`,
		`Steady week: *${s.reviewedTotal} cards reviewed*, and the rhythm shows.`,
		`*${s.reviewedTotal} cards* across ${s.activeDayCount} active days — the compounding is quiet.`,
	];
	return { tone: "neutral", text: pickByDate(seed, lines, lines[0] as string) };
}
