// Public shape of the weekly Overview report: note / recommendation /
// headline structures and the inputs envelope. Re-exported from
// ./weekly-report so existing import sites keep resolving.

import type { ApiForecastDay, ApiHeatmapDay, ApiJlptGap, ApiLayoutAccuracy } from "@fsrs-japanese/shared-types";

export type NoteKind = "progress" | "mistakes" | "planning";
export type NoteTone = "celebratory" | "attention" | "neutral";
export type RecommendationTone = "attention" | "pacing" | "celebratory";
export type FigureKind = "retention" | "mistakes" | "forecast";

/**
 * One unit of the report body. Each note carries its own copy, tone, and
 * (optionally) a figure spec. The page renders these in rank order with
 * different chrome per weight.
 */
export interface ReportNote {
	kind: NoteKind;
	tone: NoteTone;
	/** Section ornament — single kanji. */
	kanji: string;
	/** Small-caps eyebrow label. */
	label: string;
	/** Prose body. Emphasized fragments are wrapped in `*…*`. */
	body: string;
	/** Where the deep-link points. */
	deepLink: { label: string; href: string };
	/** Severity 0–100 — used to rank. Higher = more important this week. */
	severity: number;
	/**
	 * Figure to render when this note is the lead. `null` for compact notes.
	 * The lead note always gets its assigned figure; medium and compact notes
	 * never render one.
	 */
	figure: FigureKind | null;
}

export interface ReportRecommendation {
	tone: RecommendationTone;
	kanji: string;
	/** One-line teacher-voice diagnosis. */
	headline: string;
	/** Optional supporting sentence. */
	body?: string;
	/**
	 * Optional "do this next" CTA. Omitted for forward-looking states where
	 *  there's nothing to start yet (e.g. tomorrow's load), so the callout
	 *  stays a quiet statement rather than offering an action it can't fulfil.
	 */
	action?: { label: string; href: string };
}

export interface ReportHeadline {
	text: string;
	tone: NoteTone | "new-user";
}

export interface WeekWindow {
	/** ISO date of the most recent Monday <= today (local). */
	weekStart: string;
	/** ISO date of the Sunday that closes the current week. */
	weekEnd: string;
	/** ISO 8601 week number, 1–53. */
	weekNumber: number;
	/** Number of days inside the current week that have any activity. */
	activeDaysThisWeek: number;
}

export interface WeeklyReport {
	window: WeekWindow;
	headline: ReportHeadline;
	recommendation: ReportRecommendation;
	notes: { lead: ReportNote; second: ReportNote; third: ReportNote };
	/** True when there isn't enough data to produce meaningful insights. */
	lowData: boolean;
}

export interface WeeklyReportInputs {
	heatmap: ReadonlyArray<ApiHeatmapDay>;
	accuracy: ReadonlyArray<ApiLayoutAccuracy>;
	jlptGap: ReadonlyArray<ApiJlptGap>;
	forecast: ReadonlyArray<ApiForecastDay>;
}
