import type { ApiAnalyticsDashboard, ApiForecastDay } from "@fsrs-japanese/shared-types";

import type { NoteKind, ReportNote, WeeklyReport, WeeklyReportInputs } from "./weekly-report-types";
import { buildWeekWindow } from "./weekly-report-dates";
import { buildHeadline, buildMistakesNote, buildPlanningNote, buildProgressNote, buildRecommendation } from "./weekly-report-notes";
import { deriveSignals } from "./weekly-report-signals";

// Re-export the public report shapes so existing import sites (./weekly-report)
// keep resolving after the split into types / dates / signals / notes.
export type { FigureKind, NoteKind, NoteTone, RecommendationTone, ReportHeadline, ReportNote, ReportRecommendation, WeeklyReport, WeeklyReportInputs, WeekWindow } from "./weekly-report-types";

/** Days of activity across the full heatmap before any insights are meaningful. */
export const MIN_ACTIVE_DAYS_FOR_INSIGHTS = 3;

// ── Inputs builder ───────────────────────────────────────────────────────────
export function buildWeeklyReportInputs(
	dashboard: ApiAnalyticsDashboard | undefined,
	forecast: ReadonlyArray<ApiForecastDay> | undefined,
): WeeklyReportInputs {
	return {
		// Heatmap retention is 0–100 on the wire; the entire Overview module
		// (narrative thresholds in `meanRetention`/`deriveSignals` and the
		// `RetentionChart` percentage formatting) assumes a 0–1 fraction.
		// Normalize once here, at the live ingestion boundary, exactly as the
		// Statistics page does in `adapt-live.ts`. Dev fixtures already supply
		// fractions and bypass this builder, so they are unaffected.
		heatmap: (dashboard?.heatmap.items ?? []).map(d => ({
			...d,
			retention: d.count > 0 ? d.retention / 100 : 0,
		})),
		accuracy: dashboard?.accuracy.items ?? [],
		jlptGap: dashboard?.jlptGap.items ?? [],
		forecast: forecast ?? [],
	};
}

// ── The full report builder ──────────────────────────────────────────────────
/**
 * Build the full weekly report. Pure function — same inputs + seed always
 * produce the same report, so tests and previews can pin the output.
 *
 * `todayIso` is the learner-local YYYY-MM-DD for "today"; `seed` is used to
 * date-rotate neutral copy on ties.
 */
export function buildWeeklyReport(
	inputs: WeeklyReportInputs,
	todayIso: string,
	seed: string = todayIso,
): WeeklyReport {
	const window = buildWeekWindow(todayIso, inputs.heatmap);
	const signals = deriveSignals(inputs);
	const lowData = signals.activeDayCount < MIN_ACTIVE_DAYS_FOR_INSIGHTS;

	if (lowData) {
		const startNote: ReportNote = {
			kind: "progress",
			tone: "neutral",
			kanji: "始",
			label: "Just starting",
			severity: 0,
			figure: null,
			body:
        "Your report will arrive after three or four sessions. Until then, the patterns are too thin to read honestly.",
			deepLink: { label: "Start your first review", href: "/today" },
		};
		const placeholderMistakes: ReportNote = {
			kind: "mistakes",
			tone: "neutral",
			kanji: "弱",
			label: "Mistake patterns",
			severity: 0,
			figure: null,
			body: "Mistake patterns surface once you have a handful of reviews behind you.",
			deepLink: { label: "Open weak spots", href: "/weak-spots" },
		};
		const placeholderPlanning: ReportNote = {
			kind: "planning",
			tone: "neutral",
			kanji: "次",
			label: "The week ahead",
			severity: 0,
			figure: null,
			body: "A forecast appears once a few cards are scheduled forward.",
			deepLink: { label: "Open forecast", href: "/insights/forecast" },
		};
		return {
			window,
			headline: {
				tone: "new-user",
				text: "Insights need a few sessions to find their shape. *Three or four more* will do it.",
			},
			recommendation: {
				tone: "pacing",
				kanji: "始",
				headline: "Run your first review to start the report.",
				action: { label: "Start a review", href: "/today" },
			},
			notes: { lead: startNote, second: placeholderMistakes, third: placeholderPlanning },
			lowData: true,
		};
	}

	const progress = buildProgressNote(signals);
	const mistakes = buildMistakesNote(signals);
	const planning = buildPlanningNote(signals);

	// The three notes always render in the same slots — progress leads, mistakes
	// sits in the medium slot, planning closes in the compact slot — so the
	// sections never swap positions between loads. Severity is used only to pick
	// which note steers the headline and recommendation copy at the top of the
	// page (a single fixed-position element), not to reorder the cards below.
	const mostSevere = [progress, mistakes, planning].sort((a, b) => {
		if (a.severity !== b.severity)
			return b.severity - a.severity;
		// Deterministic tiebreak: progress > mistakes > planning when severities tie.
		const order: Record<NoteKind, number> = { progress: 0, mistakes: 1, planning: 2 };
		return order[a.kind] - order[b.kind];
	})[0] as ReportNote;

	return {
		window,
		headline: buildHeadline(mostSevere, signals, seed),
		recommendation: buildRecommendation(mostSevere, signals),
		notes: { lead: progress, second: mistakes, third: planning },
		lowData: false,
	};
}

// ── Emphasis splitter (re-exported from former headline-insight.ts) ──────────

/**
 * Splits a body string into alternating plain / emphasized chunks at the
 * `*…*` markers. The renderer styles the emphasized chunks distinctly
 * (vermillion in attention/celebratory contexts, sumi in neutral).
 */
export function splitEmphasis(text: string): Array<{ kind: "plain" | "em"; text: string }> {
	const parts: Array<{ kind: "plain" | "em"; text: string }> = [];
	let cursor = 0;
	const re = /\*([^*]+)\*/g;
	let match: RegExpExecArray | null = re.exec(text);
	while (match !== null) {
		if (match.index > cursor)
			parts.push({ kind: "plain", text: text.slice(cursor, match.index) });
		parts.push({ kind: "em", text: match[1] ?? "" });
		cursor = re.lastIndex;
		match = re.exec(text);
	}
	if (cursor < text.length)
		parts.push({ kind: "plain", text: text.slice(cursor) });
	return parts;
}
