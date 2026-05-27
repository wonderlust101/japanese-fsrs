import type {
	SessionSummary,
	SessionWeakSpot,
} from "@fsrs-japanese/shared-types";

import type { SessionPattern } from "@/lib/review/summary-pattern";

// Extended fixture key space. Adds 'first-session' and 'multi-session-day'
// — orthogonal dimensions to the session-pattern classifier, used purely
// for previewing first-run copy and the multi-session pluralized label.
// They map to SessionPattern under the hood via the metric shape inside
// each fixture (the classifier still runs on the data, not the key).
export type FixturePattern
	= | SessionPattern
		| "first-session"
		| "multi-session-day";

// Synthetic SessionSummary payloads, one per session pattern, used by the dev
// dock to drive every state without needing a backend round-trip. The shape
// satisfies SessionSummarySchema; values are picked to land squarely inside
// each pattern's classifier branch.

// Helper for building varied lastLapseAt timestamps relative to "now" so
// the fixture grid displays a realistic spread of "Nd ago" / "Nw ago"
// relative dates without needing to keep ISO strings in lockstep with the
// system clock.
function daysAgo(n: number): string {
	return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
}

const SAMPLE_LEECHES: SessionWeakSpot[] = [
	{
		weakSpotId: "weakSpot-1",
		cardId: "card-hiraku",
		deckId: "deck-jlpt-n4",
		word: "開く",
		reading: "ひらく",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(1),
		lapses: 12,
		lastLapseAt: daysAgo(0),
	},
	{
		weakSpotId: "weakSpot-2",
		cardId: "card-akeru",
		deckId: "deck-jlpt-n4",
		word: "開ける",
		reading: "あける",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(2),
		lapses: 14,
		lastLapseAt: daysAgo(1),
	},
	{
		weakSpotId: "weakSpot-3",
		cardId: "card-shimaru",
		deckId: "deck-jlpt-n4",
		word: "閉まる",
		reading: "しまる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(5),
		lapses: 9,
		lastLapseAt: daysAgo(2),
	},
	{
		weakSpotId: "weakSpot-4",
		cardId: "card-shimeru",
		deckId: "deck-jlpt-n4",
		word: "閉める",
		reading: "しめる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(3),
		lapses: 11,
		lastLapseAt: daysAgo(2),
	},
	{
		weakSpotId: "weakSpot-5",
		cardId: "card-tsutaeru",
		deckId: "deck-jlpt-n4",
		word: "伝える",
		reading: "つたえる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(8),
		lapses: 3,
		lastLapseAt: daysAgo(4),
	},
	{
		weakSpotId: "weakSpot-6",
		cardId: "card-tsutawaru",
		deckId: "deck-jlpt-n4",
		word: "伝わる",
		reading: "つたわる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(6),
		lapses: 10,
		lastLapseAt: daysAgo(3),
	},
	{
		weakSpotId: "weakSpot-7",
		cardId: "card-kuwaeru",
		deckId: "deck-jlpt-n3",
		word: "加える",
		reading: "くわえる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(12),
		lapses: 13,
		lastLapseAt: daysAgo(7),
	},
	{
		weakSpotId: "weakSpot-8",
		cardId: "card-kuwawaru",
		deckId: "deck-jlpt-n3",
		word: "加わる",
		reading: "くわわる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(14),
		lapses: 16,
		lastLapseAt: daysAgo(5),
	},
	{
		weakSpotId: "weakSpot-9",
		cardId: "card-kawaru",
		deckId: "deck-jlpt-n4",
		word: "変わる",
		reading: "かわる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(10),
		lapses: 9,
		lastLapseAt: daysAgo(6),
	},
	{
		weakSpotId: "weakSpot-10",
		cardId: "card-kaeru",
		deckId: "deck-jlpt-n4",
		word: "変える",
		reading: "かえる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(20),
		lapses: 5,
		lastLapseAt: daysAgo(11),
	},
	{
		weakSpotId: "weakSpot-11",
		cardId: "card-tomaru",
		deckId: "deck-jlpt-n5",
		word: "止まる",
		reading: "とまる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(18),
		lapses: 11,
		lastLapseAt: daysAgo(9),
	},
	{
		weakSpotId: "weakSpot-12",
		cardId: "card-tomeru",
		deckId: "deck-jlpt-n5",
		word: "止める",
		reading: "とめる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(22),
		lapses: 17,
		lastLapseAt: daysAgo(14),
	},
	{
		weakSpotId: "weakSpot-13",
		cardId: "card-hairu",
		deckId: "deck-jlpt-n5",
		word: "入る",
		reading: "はいる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(30),
		lapses: 6,
		lastLapseAt: daysAgo(18),
	},
	{
		weakSpotId: "weakSpot-14",
		cardId: "card-ireru",
		deckId: "deck-jlpt-n5",
		word: "入れる",
		reading: "いれる",
		diagnosis: null,
		prescription: null,
		resolved: false,
		createdAt: daysAgo(40),
		lapses: 2,
		lastLapseAt: daysAgo(25),
	},
];

function base(sessionId: string): Pick<SessionSummary, "sessionId" | "nextDueAt"> {
	return {
		sessionId,
		nextDueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
	};
}

// Pre-baked AI diagnoses + prescriptions keyed by cardId. Used to give
// fixture weak spots the same shape they'd have after the batch-diagnose
// endpoint had populated them in production. Lets the inline expand
// affordance render without firing a single network call.
const FIXTURE_DIAGNOSES: Record<string, { diagnosis: string; prescription: string }> = {
	"card-hiraku": {
		diagnosis: "You keep reaching for the transitive sense first. ひらく opens spontaneously — a flower, a door swinging on its own.",
		prescription: "Practice the pair 開く / 開ける side by side. Drill a few sentences where the agent matters.",
	},
	"card-akeru": {
		diagnosis: "The transitive form lapses when the subject is implicit. You translate too literally from English.",
		prescription: "Try producing 3 sentences where you (the speaker) open something. Notice who is doing the action.",
	},
	"card-shimaru": {
		diagnosis: "Closing-related verbs blur together. Recall takes a beat because しまる competes with しめる + 閉じる.",
		prescription: "Cluster the close-family together in a short drill. The transitive/intransitive split clarifies on repeat.",
	},
	"card-shimeru": {
		diagnosis: "You hesitate on which kanji-pair carries the transitive meaning. The reading is solid; the meaning slips.",
		prescription: "Anchor 閉める to a concrete physical image: closing a door with your hand.",
	},
	"card-tsutaeru": {
		diagnosis: "New entry; pattern not yet established.",
		prescription: "Continue the standard schedule. Recall will firm up over the next two reviews.",
	},
	"card-tsutawaru": {
		diagnosis: "Confusion with 伝える. The passive/spontaneous sense (a story spreading) is harder to picture.",
		prescription: "Try a one-line mnemonic about news spreading on its own. Concrete image, not grammar rules.",
	},
	"card-kuwaeru": {
		diagnosis: "High lapse count from frequent rating disagreement. You rated Good then Again on consecutive reviews.",
		prescription: "Rebuild from scratch: think of 加える as the act of adding, with you as the active agent.",
	},
	"card-kuwawaru": {
		diagnosis: "Very high lapse rate. The passive/intransitive twin keeps slipping under the transitive 加える.",
		prescription: "Treat 加わる as priority for the next drill. A 5-card focused session usually clears the pattern.",
	},
	"card-kawaru": {
		diagnosis: "Mid-tier confusion with 変える. You produce the meaning eventually but recall is slow.",
		prescription: "No urgent action. The next 2-3 reviews should stabilize as the pair settles into separate slots.",
	},
	"card-kaeru": {
		diagnosis: "Just over the threshold. You miss the active sense (\"I change something\") about a third of the time.",
		prescription: "Drill one example sentence with a clear agent. The English \"to change\" carries both senses; Japanese splits them.",
	},
	"card-tomaru": {
		diagnosis: "Reliable intransitive read; the kanji 止 confuses across 止まる / 止める / 留まる.",
		prescription: "Picture a train stopping by itself for 止まる. Anchor the image; the recall follows.",
	},
	"card-tomeru": {
		diagnosis: "Highest-lapse card today. Repeated misses suggest the transitive sense is genuinely fragile.",
		prescription: "Schedule a focused weak-spot drill within the next two days. Cluster 止める with its sibling pair.",
	},
	"card-hairu": {
		diagnosis: "Just over the threshold. Reading is solid; the lapses cluster around mismatched usage in compounds.",
		prescription: "Pause on the simple 入る reading. Add nuance only after the base sense is rock-solid.",
	},
	"card-ireru": {
		diagnosis: "Active-sense confusion. The English \"put in\" maps to both いれる and 詰める in different contexts.",
		prescription: "Restrict practice to the most common 入れる usage (putting something into a container) for a few cycles.",
	},
};

// Card ids that should stay undiagnosed in the fixture output even though
// FIXTURE_DIAGNOSES has copy for them. Lets the dev dock preview the
// "diagnosis pending" row state (no chevron, no disclosure) next to the
// fully-populated rows in the same list — mirrors the in-flight window
// between session-close and batch-diagnose returning.
const UNDIAGNOSED_FIXTURE_CARD_IDS: ReadonlySet<string> = new Set([
	"card-kaeru",
	"card-hairu",
	"card-tomaru",
]);

// Patch SAMPLE_LEECHES with the pre-baked diagnoses so fixtures look
// fully populated without firing batch-diagnose. Cards in
// UNDIAGNOSED_FIXTURE_CARD_IDS are deliberately skipped so the list
// renders a realistic mix of diagnosed + pending rows.
const SAMPLE_LEECHES_WITH_DIAGNOSIS: SessionWeakSpot[] = SAMPLE_LEECHES.map((l) => {
	if (UNDIAGNOSED_FIXTURE_CARD_IDS.has(l.cardId))
		return l;
	const entry = FIXTURE_DIAGNOSES[l.cardId];
	if (entry === undefined)
		return l;
	return { ...l, diagnosis: entry.diagnosis, prescription: entry.prescription };
});

export const SUMMARY_FIXTURES: Record<FixturePattern, SessionSummary> = {
	"strong": {
		...base("fixture-strong"),
		totalCards: 38,
		totalTimeMs: 9 * 60 * 1000,
		accuracyPct: 95,
		ratingBreakdown: { again: 0, hard: 2, good: 28, easy: 8 },
		weakSpots: [],
		userTotalSessions: 2,
		sessionsToday: 1,
	},
	"mixed": {
		...base("fixture-mixed"),
		totalCards: 42,
		totalTimeMs: 11 * 60 * 1000 + 20 * 1000,
		accuracyPct: 81,
		ratingBreakdown: { again: 4, hard: 5, good: 24, easy: 9 },
		weakSpots: SAMPLE_LEECHES_WITH_DIAGNOSIS.slice(0, 2),
		userTotalSessions: 2,
		sessionsToday: 1,
	},
	"difficult": {
		...base("fixture-difficult"),
		totalCards: 35,
		totalTimeMs: 14 * 60 * 1000,
		accuracyPct: 58,
		ratingBreakdown: { again: 12, hard: 8, good: 12, easy: 3 },
		weakSpots: SAMPLE_LEECHES_WITH_DIAGNOSIS.slice(0, 2),
		userTotalSessions: 2,
		sessionsToday: 1,
	},
	"weakSpot": {
		...base("fixture-weakSpot"),
		totalCards: 44,
		totalTimeMs: 13 * 60 * 1000,
		accuracyPct: 72,
		ratingBreakdown: { again: 6, hard: 6, good: 26, easy: 6 },
		weakSpots: SAMPLE_LEECHES_WITH_DIAGNOSIS,
		userTotalSessions: 2,
		sessionsToday: 1,
	},
	"ended-early": {
		...base("fixture-ended-early"),
		totalCards: 14,
		totalTimeMs: 4 * 60 * 1000,
		accuracyPct: 79,
		ratingBreakdown: { again: 2, hard: 2, good: 8, easy: 2 },
		weakSpots: SAMPLE_LEECHES_WITH_DIAGNOSIS.slice(0, 1),
		userTotalSessions: 2,
		sessionsToday: 1,
	},
	"no-pattern": {
		...base("fixture-no-pattern"),
		totalCards: 3,
		totalTimeMs: 90 * 1000,
		accuracyPct: 100,
		ratingBreakdown: { again: 0, hard: 0, good: 2, easy: 1 },
		weakSpots: [],
		userTotalSessions: 2,
		sessionsToday: 1,
	},
	// First-session variant — drives the new-user copy branch on the
	// ClosureHeader. Small card count, no weak spots, clean accuracy.
	"first-session": {
		...base("fixture-first-session"),
		totalCards: 6,
		totalTimeMs: 3 * 60 * 1000,
		accuracyPct: 83,
		ratingBreakdown: { again: 1, hard: 0, good: 4, easy: 1 },
		weakSpots: [],
		userTotalSessions: 1,
		sessionsToday: 1,
	},
	// Multi-session day variant — drives the pluralized closure-card label.
	// 3 sessions today, mid-pattern weak spots, returning user.
	"multi-session-day": {
		...base("fixture-multi-session-day"),
		totalCards: 22,
		totalTimeMs: 7 * 60 * 1000,
		accuracyPct: 77,
		ratingBreakdown: { again: 3, hard: 2, good: 14, easy: 3 },
		weakSpots: SAMPLE_LEECHES_WITH_DIAGNOSIS.slice(0, 2),
		userTotalSessions: 2,
		sessionsToday: 3,
	},
};

export const SUMMARY_FIXTURE_KEYS: FixturePattern[] = [
	"strong",
	"mixed",
	"difficult",
	"weakSpot",
	"ended-early",
	"no-pattern",
	"first-session",
	"multi-session-day",
];

export function summaryFixtureLabel(pattern: FixturePattern): string {
	switch (pattern) {
		case "strong": return "Strong session";
		case "mixed": return "Mixed session";
		case "difficult": return "Difficult session";
		case "weakSpot": return "WeakSpot-like";
		case "ended-early": return "Ended early";
		case "no-pattern": return "No pattern";
		case "first-session": return "First session (new user)";
		case "multi-session-day": return "Multi-session day";
	}
}

// Mock meanings keyed by cardId, used by WeakSpotRow when the fixture
// renders. Production rows source meaning from card detail, not from the
// summary payload — but the fixtures should look fleshed out.
export const FIXTURE_MEANINGS: Record<string, string> = {
	"card-hiraku": "to open (intransitive)",
	"card-akeru": "to open (transitive)",
	"card-shimaru": "to close (intransitive)",
	"card-shimeru": "to close (transitive)",
	"card-tsutaeru": "to convey, to tell (transitive)",
	"card-tsutawaru": "to be conveyed, to spread (intransitive)",
	"card-kuwaeru": "to add (transitive)",
	"card-kuwawaru": "to be added, to join (intransitive)",
	"card-kawaru": "to change (intransitive)",
	"card-kaeru": "to change (transitive)",
	"card-tomaru": "to stop (intransitive)",
	"card-tomeru": "to stop (transitive)",
	"card-hairu": "to enter (intransitive)",
	"card-ireru": "to put in, to insert (transitive)",
};
