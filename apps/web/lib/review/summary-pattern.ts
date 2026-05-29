import type { PatternInputs, SessionPattern, SessionSummary } from "@fsrs-japanese/shared-types";
import {
	assertNever,
	classifySession,

} from "@fsrs-japanese/shared-types";

// Pattern-to-prose mapping for the review summary UI. The classifier
// itself lives in shared-types/review/classify-session.ts so the backend
// fallback (apps/api/src/services/day-reflection.service.ts) can reuse
// the exact same predicate ladder without drift. Per-pattern prose stays
// here because the UI copy and the backend fallback copy are allowed to
// diverge intentionally.

export type { PatternInputs, SessionPattern };
export { classifySession };

export function inputsFromSummary(
	summary: SessionSummary,
	endedEarly: boolean,
): PatternInputs {
	return {
		totalCards: summary.totalCards,
		accuracyPct: summary.accuracyPct,
		again: summary.ratingBreakdown.again,
		hard: summary.ratingBreakdown.hard,
		good: summary.ratingBreakdown.good,
		easy: summary.ratingBreakdown.easy,
		weakSpotCount: summary.weakSpots.length,
		endedEarly,
	};
}

// ── Content mapping ──────────────────────────────────────────────────────────
// One copy block per state. Hero copy lives on the page substrate, rationale
// frames the recommended action as a teacher's suggestion, and the action
// labels follow the IA brief's "Primary Action Logic" table. Routes are best-
// effort against the current router; missing destinations degrade to /today.

export type ActionRoute
	= | { kind: "today" }
		| { kind: "repair" }
		| { kind: "review-weak-spots"; cardIds: string[] }
		| { kind: "insights" };

export interface SummaryContent {
	pattern: SessionPattern;
	kicker: { kanji: string; label: string };
	heroHeadline: string;
	heroSubcopy?: string | undefined;
	diagnosisLead: string;
	diagnosisAside: string | null;
	rationale: string;
	primary: { label: string; route: ActionRoute };
	secondary?: { label: string; route: ActionRoute } | undefined;
	showWeakSpots: boolean;
	showTomorrowGlance: boolean;
}

interface ContentInputs {
	inputs: PatternInputs;
	pattern: SessionPattern;
	weakSpotIds: string[];
	weakSpotTokens: string[];
}

export function buildSummaryContent(
	summary: SessionSummary,
	endedEarly: boolean,
): SummaryContent {
	const inputs = inputsFromSummary(summary, endedEarly);
	const pattern = classifySession(inputs);
	const weakSpotIds = summary.weakSpots.map(l => l.cardId);
	const weakSpotTokens = summary.weakSpots.slice(0, 3).map(l => l.word);
	return mapPattern({ inputs, pattern, weakSpotIds, weakSpotTokens });
}

function mapPattern({ inputs, pattern, weakSpotIds, weakSpotTokens }: ContentInputs): SummaryContent {
	const baseShow = {
		showWeakSpots: inputs.weakSpotCount > 0,
		showTomorrowGlance: true,
	};

	// Inline-Japanese specifics line. Stays null when there are no weakSpots.
	const specifics = weakSpotTokens.length > 0
		? `${formatTokens(weakSpotTokens)} showed up in repeated misses.`
		: null;

	switch (pattern) {
		case "strong":
			return {
				pattern,
				kicker: { kanji: "済", label: "All done" },
				heroHeadline: "Beautifully done.",
				heroSubcopy: "That was a clean run. Enjoy the rest of your morning.",
				diagnosisLead: "No clear weak spot today.",
				diagnosisAside: null,
				rationale: "Today reads as a strong session. The deck is settled; leave the rest for tomorrow.",
				primary: { label: "Leave for today", route: { kind: "today" } },
				secondary: undefined,
				showWeakSpots: false,
				showTomorrowGlance: true,
			};

		case "mixed":
			return {
				pattern,
				kicker: { kanji: "済", label: "Session wrapped" },
				heroHeadline: "Nicely wrapped.",
				heroSubcopy: "A few rough spots, nothing alarming.",
				diagnosisLead: "A few rough spots, nothing alarming.",
				diagnosisAside: specifics,
				rationale: "Most of the session held together. The few rough spots can wait until tomorrow.",
				primary: { label: "Leave for today", route: { kind: "today" } },
				secondary: inputs.weakSpotCount > 0
					? { label: "Improve weak spots", route: { kind: "repair" } }
					: undefined,
				...baseShow,
			};

		case "difficult":
			return {
				pattern,
				kicker: { kanji: "済", label: "Session wrapped" },
				heroHeadline: "You stayed with it.",
				heroSubcopy: "That was a heavy one. The effort still counts.",
				diagnosisLead: "Recall sat lower than usual. A short focused drill will help.",
				diagnosisAside: specifics,
				rationale: "A short drill on the cards below settles the rough spots without restarting the day.",
				primary: weakSpotIds.length > 0
					? { label: "Review weak spots", route: { kind: "review-weak-spots", cardIds: weakSpotIds } }
					: { label: "Open Insights", route: { kind: "insights" } },
				secondary: { label: "Leave for today", route: { kind: "today" } },
				...baseShow,
			};

		case "weakSpot":
			return {
				pattern,
				kicker: { kanji: "済", label: "Session wrapped" },
				heroHeadline: "Practice done.",
				heroSubcopy: "A handful of cards keep slipping. Worth a closer look.",
				diagnosisLead: "A handful of cards keep slipping. They look like weak spots.",
				diagnosisAside: specifics,
				rationale: "Repairing the cards below once is usually enough to break the loop.",
				primary: { label: "Improve weak spots", route: { kind: "repair" } },
				secondary: { label: "Leave for today", route: { kind: "today" } },
				...baseShow,
			};

		case "ended-early":
			return {
				pattern,
				kicker: { kanji: "中", label: "Paused for now" },
				heroHeadline: "Stopped at a good spot.",
				heroSubcopy: "Partial sessions still count.",
				diagnosisLead: inputs.weakSpotCount > 0
					? "A short stop is fine; the rough spots will come back around."
					: "A short stop is fine. The schedule adjusts.",
				diagnosisAside: specifics,
				rationale: "Stopping at a reasonable point is part of the practice. The remaining cards are still scheduled.",
				primary: { label: "Leave for today", route: { kind: "today" } },
				secondary: inputs.weakSpotCount > 0
					? { label: "Improve weak spots", route: { kind: "repair" } }
					: undefined,
				...baseShow,
			};

		case "no-pattern":
			return {
				pattern,
				kicker: { kanji: "済", label: "Short and sweet" },
				heroHeadline: "Short and sweet.",
				heroSubcopy: "A brief one today. Every pass keeps the rhythm.",
				diagnosisLead: "Short session today.",
				diagnosisAside: "Not enough cards to call a pattern.",
				rationale: "Nothing requires action. Leave the rest for tomorrow.",
				primary: { label: "Leave for today", route: { kind: "today" } },
				secondary: undefined,
				showWeakSpots: inputs.weakSpotCount > 0,
				showTomorrowGlance: false,
			};

		default:
			return assertNever(pattern);
	}
}

// Comma-joined list with a final "and"; keeps the diagnosis sentence readable
// when more than two tokens appear (capped at three by the caller).
function formatTokens(tokens: string[]): string {
	const last = tokens[tokens.length - 1];
	if (last === undefined)
		return "";
	if (tokens.length === 1)
		return last;
	if (tokens.length === 2)
		return `${tokens[0]} and ${tokens[1]}`;
	return `${tokens.slice(0, -1).join(", ")}, and ${last}`;
}
