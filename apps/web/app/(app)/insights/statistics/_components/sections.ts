/**
 * Shared metadata for the Statistics page's five sections. Drives both the
 * sticky tab nav and the anchor IDs on each section heading.
 */

export type StatisticsSectionId
	= | "activity"
		| "retention"
		| "cards"
		| "scheduling"
		| "fsrs";

export interface StatisticsSection {
	id: StatisticsSectionId;
	kanji: string;
	label: string;
	question: string;
}

/** Section lookup by id — preferred for typed access in section components. */
export const STATISTICS_SECTIONS_BY_ID: Record<StatisticsSectionId, StatisticsSection> = {
	activity: { id: "activity", kanji: "動", label: "Activity", question: "How much have you studied?" },
	retention: { id: "retention", kanji: "保", label: "Retention", question: "How well are you remembering?" },
	cards: { id: "cards", kanji: "札", label: "Cards", question: "What is your collection made of?" },
	scheduling: { id: "scheduling", kanji: "次", label: "Scheduling", question: "What is coming next?" },
	fsrs: { id: "fsrs", kanji: "算", label: "FSRS", question: "How is scheduling behaving?" },
};

/**
 * Ordered list — drives the nav and the page layout. Retention leads: the
 * learner arrives from the Insights overview already oriented, so the page
 * opens on the outcome they care about (am I remembering?) rather than raw
 * effort, then moves through effort, collection, schedule, and ends on the
 * FSRS internals before the page's closing call to action.
 */
export const STATISTICS_SECTIONS: ReadonlyArray<StatisticsSection> = [
	STATISTICS_SECTIONS_BY_ID.retention,
	STATISTICS_SECTIONS_BY_ID.activity,
	STATISTICS_SECTIONS_BY_ID.cards,
	STATISTICS_SECTIONS_BY_ID.scheduling,
	STATISTICS_SECTIONS_BY_ID.fsrs,
];
