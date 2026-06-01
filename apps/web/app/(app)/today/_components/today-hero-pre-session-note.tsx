"use client";

// The Due hero pre-session note: weak-spots peek row, daily Tomo note, or a
// date-seeded preparation line. Sits between the headline and the queue chips.

import type { ApiTomoNote, ApiWeakSpotListItem } from "@fsrs-japanese/shared-types";

import { TeacherNote } from "@/components/review/TeacherNote";
import { FuriganaText } from "@/components/ui/FuriganaText";
import { QuietLink } from "@/components/ui/QuietLink";
import { useTomoNoteQuery } from "@/lib/api/tomo";
import { useWeakSpotsQuery } from "@/lib/api/weak-spots";

import { WEAK_SPOT_PEEK_LIMIT, WEAK_SPOT_QUERY_LIMIT } from "./today-hero-types";

// ── Preparation lines ────────────────────────────────────────────────────────
// Fallback frames for the pre-session note slot. Used when the weak-spots
// query is still loading or the Tomo note quota is spent — the slot never
// collapses, so the hero's vertical rhythm stays stable.
const PREPARATION_LINES = [
	"Each card seen is one settled.",
	"Be honest with the ratings. The schedule does the rest.",
	"Recall is a muscle; this is the practice.",
	"The harder ones teach the most.",
	"Sit with each card. The work happens in the recall.",
	"Some cards will feel new again. That is allowed.",
	"One card, then the next. No race here.",
] as const;

const DEFAULT_PREPARATION_LINE: string = PREPARATION_LINES[0];

// Deterministic pick from the line pool — pure so tests/previews can pass
// any seed.
function pickPreparationLine(seed: string): string {
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return PREPARATION_LINES[hash % PREPARATION_LINES.length] ?? DEFAULT_PREPARATION_LINE;
}

// ── Hero pre-session note ────────────────────────────────────────────────────
//
// Sits between the headline and the queue chips inside the Due hero. Picks
// one of three contents based on the learner's current state:
//
//   1. Unresolved weak spots → a one-line signal with a word peek (up to two
//      Japanese words + a "+N more" overflow) and an inline drill CTA. The
//      operational signal wins because it is actionable and the next thing
//      the learner should consider before starting.
//   2. Today's Tomo note → the daily teacher-voice prose, rendered as one
//      calm line. Stripped of the standalone-passage chrome (ISO stamp,
//      Japanese weekday, Kotowaza pill, end seal) — those existed when the
//      note lived in its own block; inside the hero they would compete with
//      the headline and the kicker. The body alone reads as a passage when
//      the hero is otherwise quiet.
//   3. Fallback — a date-seeded teacher-voice preparation line. Used while
//      the queries are loading, when the AI quota is spent, or in any
//      hero-preview surface that doesn't wire a real calendar. Keeps the
//      slot's vertical rhythm stable so the chips/CTA don't shift when data
//      arrives.
//
// Elevated visual weight (sumi-ink, slightly larger than body) is deliberate
// — this is the orientation the learner reads before starting, not filler.

export function HeroPreSessionNote({ dateKey, isFirstVisit = false }: { dateKey: string | undefined; isFirstVisit?: boolean }): React.JSX.Element {
	// Both queries are awaited at the route level by today-client's PageGate
	// (see today-client.tsx, `pageReady`). By the time this component
	// mounts, the TanStack Query cache is warm and these hooks return
	// resolved data on first render — no loading branch needed.
	const weakSpotsQuery = useWeakSpotsQuery({
		status: "unresolved",
		limit: WEAK_SPOT_QUERY_LIMIT,
		sort: "mostRecent",
	});
	const weakSpotItems = weakSpotsQuery.data?.items ?? [];
	const hasWeakSpots = weakSpotItems.length > 0;

	// Only spend the AI quota on calm days. The route gate mirrors this
	// exact condition (see `tomoNoteEnabled` in today-client). Disabled for
	// first-visit users who have no review history to reflect on.
	const tomoNoteEnabled = !isFirstVisit && !hasWeakSpots && dateKey !== undefined && !weakSpotsQuery.isError;
	const tomoNoteQuery = useTomoNoteQuery({
		dateKey: dateKey ?? "",
		enabled: tomoNoteEnabled,
	});

	// First-time users have no review history to reflect on. Skip the AI path
	// entirely and show a static orientation note instead.
	if (isFirstVisit) {
		return <FirstVisitNote />;
	}

	if (hasWeakSpots) {
		return (
			<WeakSpotsNoteRow
				items={weakSpotItems}
				hasMore={(weakSpotsQuery.data?.totalCount ?? 0) > weakSpotItems.length}
			/>
		);
	}

	if (tomoNoteEnabled) {
		const note = tomoNoteQuery.data;
		if (note !== null && note !== undefined) {
			return <TomoNoteRow note={note} />;
		}
	}

	return <FallbackPreparationRow dateKey={dateKey} />;
}

function WeakSpotsNoteRow({
	items,
	hasMore,
}: {
	items: readonly ApiWeakSpotListItem[];
	hasMore: boolean;
}): React.JSX.Element {
	const visible = items.slice(0, WEAK_SPOT_PEEK_LIMIT);
	const overflowCount = Math.max(0, items.length - visible.length) + (hasMore ? 1 : 0);

	// Approximate total. Exact count would need a separate query; for a
	// pre-session note the magnitude ("how many") matters more than the
	// last digit. `3+` reads as "at least three" without overpromising
	// precision the API doesn't return on this path.
	const approxTotal = visible.length + overflowCount;
	const totalLabel = hasMore ? `${approxTotal}+` : `${approxTotal}`;
	const verbAgreement = approxTotal === 1 ? "keeps" : "keep";
	const cardWord = approxTotal === 1 ? "card" : "cards";
	const drillCopy = approxTotal === 1 ? "Drill it first" : "Drill them first";

	const wordPeeks = visible.map((spot, index) => {
		const isLast = index === visible.length - 1 && overflowCount === 0;
		return (
			<span key={spot.id} className="font-display not-italic text-sumi-ink">
				{spot.word !== null && spot.reading !== null
					? (
							<FuriganaText text={spot.word} reading={spot.reading} rtSize="0.36em" />
						)
					: (
							<span className={spot.word === null ? "italic text-faded-sumi" : ""}>
								{spot.word ?? "—"}
							</span>
						)}
				{!isLast && <span aria-hidden="true">, </span>}
			</span>
		);
	});

	// Same quote treatment as FallbackPreparationRow: hanging `「` in the left
	// grid column, italic prose, closing `」` inline at the end. Numbers,
	// word peeks, and the drill link below stay upright via `not-italic` so
	// the italic only carries the prose voice, not the data tokens or the
	// affordance.
	return (
		<blockquote
			cite="Tomo"
			className="mt-6 mb-6 max-w-measure break-words italic text-base leading-[1.55] text-sumi-ink sm:text-md"
		>
			<p>
				<span
					aria-hidden="true"
					lang="ja"
					className="mr-0.5 inline-block text-[1.25em] leading-none select-none not-italic text-inari-vermillion/85"
				>
					「
				</span>
				<span className="tabular-nums font-medium">{totalLabel}</span>
				{" "}
				{cardWord}
				{" "}
				{verbAgreement}
				{" "}
				catching you
				{visible.length > 0
					? (
							<>
								{": "}
								{wordPeeks}
								{overflowCount > 0 && (
									<span className="tabular-nums text-faded-sumi">
										{visible.length > 0 ? ", " : ""}
										+
										{overflowCount}
									</span>
								)}
							</>
						)
					: null}
				.
				<span
					aria-hidden="true"
					lang="ja"
					className="ml-0.5 inline-block text-[1.25em] leading-none select-none not-italic text-inari-vermillion/85"
				>
					」
				</span>
			</p>
			<p className="mt-2">
				<QuietLink href="/weak-spots/drill/setup" tone="brand" trailingArrow>
					{drillCopy}
				</QuietLink>
			</p>
		</blockquote>
	);
}

function TomoNoteRow({ note }: { note: ApiTomoNote }): React.JSX.Element {
	return <TeacherNote kanji="言" label="For today">{note.body}</TeacherNote>;
}

function FallbackPreparationRow({ dateKey }: { dateKey: string | undefined }): React.JSX.Element {
	// Pure render. dateKey arrives from the route's server component (built
	// with the user's timezone), so the picked line is identical on SSR and
	// on client first render — no hydration swap, no placeholder flash.
	const line = dateKey !== undefined
		? pickPreparationLine(dateKey)
		: DEFAULT_PREPARATION_LINE;
	return <TeacherNote kanji="言" label="For today">{line}</TeacherNote>;
}

function FirstVisitNote(): React.JSX.Element {
	return (
		<TeacherNote kanji="始" label="First session">
			Your first session. Rate each card honestly — the schedule learns from your answers, not your speed.
		</TeacherNote>
	);
}
