"use client";

import type { DrillAttemptsFixtureKey } from "../../../_components/drill-fixtures";
import type { DrillAttemptRecord } from "@/stores/useWeakSpotDrillSessionStore";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { PageFrame } from "@/app/(app)/_components/page-frame";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { SectionCard } from "@/components/ui/SectionCard";
import { Time } from "@/components/ui/Time";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useWeakSpotDrillSummaryDevState } from "@/dev/panels/weak-spot-drill-summary";

import { useDrillSessionQuery } from "@/lib/api/weak-spots";

import { cn } from "@/lib/utils";
import {
	useDrillActions,
	useDrillAttempts,
	useDrillExitedEarly,
	useDrillIsFinished,
	useDrillQueue,
	useWeakSpotDrillSessionStore,

} from "@/stores/useWeakSpotDrillSessionStore";
import {
	buildDevAttempts,
	isDevSessionId,

} from "../../../_components/drill-fixtures";

interface DrillSummaryClientProps {
	sessionId: string;
}

/**
 * Drill summary. Visual 1-to-1 copy of `/review/summary`:
 *
 *   - `SummaryFrame` centered grid mirrors the review summary scaffold.
 *   - `ClosureCard` carries the closure moment (kanji + label header,
 *     headline, subcopy, receipt strip, rationale, action footer, kitsune
 *     mark on lg+).
 *   - Two-column grid below: "Session details" (rating breakdown for drill's
 *     3 channels + what-to-notice prose) and "Cards" (per-attempt list).
 *
 * Read from the local Zustand store first (instant, survives a backend
 * outage). Fall back to the session detail query for the deep-link case.
 */
export function DrillSummaryClient({
	sessionId,
}: DrillSummaryClientProps): React.JSX.Element {
	useWeakSpotDrillSummaryDevState();
	const router = useRouter();
	let isDev = false;
	if (process.env.NODE_ENV === "development")
		isDev = isDevSessionId(sessionId);
	const isFinished = useDrillIsFinished();
	const exitedEarly = useDrillExitedEarly();
	const attempts = useDrillAttempts();
	const queue = useDrillQueue();
	const actions = useDrillActions();
	const searchParams = useSearchParams();

	// Dev: when ?seed=<key> is present, hydrate the store with a baked attempt
	// set. With no seed but with `dev-` sessionId, hydrate as finished+empty so
	// the existing empty branch renders without the network-error arm.
	useEffect(() => {
		// Positive `if` block so buildDevAttempts is pruned from prod (drill-fixtures
		// tree-shaken). isDev is already false in production.
		if (process.env.NODE_ENV === "development" && isDev && !isFinished) {
			const seed = searchParams.get("seed") as DrillAttemptsFixtureKey | null;
			const baked = seed !== null ? buildDevAttempts(sessionId, seed) : null;
			useWeakSpotDrillSessionStore.setState({
				phase: "finished",
				sessionId,
				queue: baked?.queue ?? [],
				attempts: baked?.attempts ?? [],
				exitedEarly: false,
				actions,
			}, true);
		}
	}, [isDev, isFinished, sessionId, searchParams, actions]);

	const detailQuery = useDrillSessionQuery(isDev || isFinished ? null : sessionId);

	// Reset the store on unmount so a stale 'finished' state doesn't trail
	// into the next visit. Same pattern as review's summary.
	useEffect(() => {
		return () => {
			if (isFinished)
				actions.reset();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only store reset; actions is a stable Zustand action. Listing deps would fire reset() via cleanup on every change, not just unmount.
	}, []);

	const metrics = useMemo(() => deriveMetrics(attempts), [attempts]);

	// ── States: loading / error / empty ──────────────────────────────────────
	if (!isFinished && detailQuery.isLoading) {
		return <SummaryFrame><PageLoader /></SummaryFrame>;
	}
	if (!isFinished && (detailQuery.isError || detailQuery.data === undefined)) {
		return (
			<SummaryFrame>
				<SectionCard kanji="失" label="Couldn’t load" stripeTone="error">
					<p className="text-sm leading-relaxed text-faded-sumi">
						Open the weak spots page to start a fresh drill, or refresh to try again.
					</p>
					<div className="mt-5">
						<Button variant="primary" onClick={() => router.push("/weak-spots")}>
							Back to Weak spots
						</Button>
					</div>
				</SectionCard>
			</SummaryFrame>
		);
	}
	if (attempts.length === 0) {
		return (
			<SummaryFrame>
				<ClosureCard
					kanji="畢"
					label="Drill ended"
					headline={exitedEarly ? "Ended before rating any cards." : "No cards were rated."}
					subcopy="Nothing was answered, so there's nothing to read. The schedule is untouched."
					receipt={null}
					rationale="Open Weak spots to start a fresh drill, or head back to Today."
					primary={{ label: "Start a new drill", onClick: () => router.push("/weak-spots/drill/setup") }}
					secondary={{ label: "Back to Weak spots", onClick: () => router.push("/weak-spots") }}
				/>
			</SummaryFrame>
		);
	}

	const closure = pickClosure(metrics, exitedEarly);

	return (
		<SummaryFrame>
			<ClosureCard
				kanji={closure.kanji}
				label={closure.label}
				headline={closure.headline}
				{...(closure.subcopy !== undefined && { subcopy: closure.subcopy })}
				receipt={{ practiced: metrics.practiced, medianRtMs: metrics.medianRtMs, exitedEarly }}
				rationale={closure.rationale}
				primary={{ label: "Start another drill", onClick: () => router.push("/weak-spots/drill/setup") }}
				secondary={{ label: "Back to Weak spots", onClick: () => router.push("/weak-spots") }}
			/>

			<div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
				<SessionDetailsCard metrics={metrics} attempts={attempts} />
				<CardsListCard attempts={attempts} queueLength={queue.length} />
			</div>
		</SummaryFrame>
	);
}

// ── Frame ───────────────────────────────────────────────────────────────────
// Thin alias over the shared PageFrame so this file's existing references
// to <SummaryFrame> keep working while the actual chrome lives in the
// canonical component. Closure-style surface: vertically centered on
// desktop, top-aligned on mobile.

function SummaryFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
	return <PageFrame desktopCentered>{children}</PageFrame>;
}

// ── Closure card ────────────────────────────────────────────────────────────
// Full-width SectionCard. Internal 2-col on lg+: text-left (kicker comes from
// SectionCard's own header), mark-right with the kitsune at 96 / 144px.

interface ActionSpec {
	label: string;
	onClick: () => void;
}

interface ReceiptInfo {
	practiced: number;
	medianRtMs: number | null;
	exitedEarly: boolean;
}

interface ClosureCardProps {
	kanji: string;
	label: string;
	headline: string;
	subcopy?: string;
	receipt: ReceiptInfo | null;
	rationale: string;
	primary: ActionSpec;
	secondary: ActionSpec;
}

function ClosureCard({
	kanji,
	label,
	headline,
	subcopy,
	receipt,
	rationale,
	primary,
	secondary,
}: ClosureCardProps): React.JSX.Element {
	return (
		<SectionCard id="drill-summary-closure" kanji={kanji} label={label}>
			<div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
				<div className="min-w-0">
					<h1 className="break-words font-display text-display leading-[1.05] text-sumi-ink">
						{headline}
					</h1>

					{subcopy !== undefined && (
						<p className="mt-3 max-w-measure text-base text-faded-sumi leading-relaxed">
							{subcopy}
						</p>
					)}

					{receipt !== null && (
						<p className="mt-6 font-mono text-xs sm:text-sm text-faded-sumi">
							<span className="text-sumi-ink">{receipt.practiced}</span>
							{" "}
							{receipt.practiced === 1 ? "card" : "cards"}
							{receipt.medianRtMs !== null && (
								<>
									<span aria-hidden="true" className="mx-2 text-soft-hairline">·</span>
									<span className="text-sumi-ink">{formatResponseTime(receipt.medianRtMs)}</span>
									{" "}
									median
								</>
							)}
							<span aria-hidden="true" className="mx-2 text-soft-hairline">·</span>
							{receipt.exitedEarly ? "ended early" : "completed"}
						</p>
					)}

					<div className="mt-7 flex flex-col gap-4">
						<p className="max-w-measure text-sm leading-relaxed text-faded-sumi">
							{rationale}
						</p>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
							<Button variant="primary" size="lg" onClick={primary.onClick}>
								{primary.label}
							</Button>
							<Button variant="editorial" size="lg" onClick={secondary.onClick}>
								{secondary.label}
							</Button>
						</div>
					</div>
				</div>

				<div aria-hidden="true" className="flex items-center justify-center lg:order-last lg:pl-4">
					<span className="inline-flex lg:hidden">
						<Logo size={96} showWordmark={false} priority />
					</span>
					<span className="hidden lg:inline-flex">
						<Logo size={144} showWordmark={false} priority />
					</span>
				</div>
			</div>
		</SectionCard>
	);
}

// ── Session details card ────────────────────────────────────────────────────
// Same chrome as review's session-details card. Top: "What to notice" prose
// classifying the session. Bottom: 3-channel rating breakdown bar.

function SessionDetailsCard({
	metrics,
	attempts,
}: {
	metrics: DerivedMetrics;
	attempts: readonly DrillAttemptRecord[];
}): React.JSX.Element {
	const diagnosis = buildDiagnosis(metrics, attempts.length);
	return (
		<SectionCard id="drill-summary-details" kanji="詳" label="Session details">
			<div className="flex flex-col gap-3">
				<p className="font-mono text-sm text-faded-sumi">
					What to notice
				</p>
				<p className="max-w-measure text-base leading-relaxed text-sumi-ink">
					{diagnosis.lead}
				</p>
				{diagnosis.aside !== null && (
					<p className="max-w-measure text-sm leading-relaxed text-faded-sumi">
						{diagnosis.aside}
					</p>
				)}
			</div>

			<hr aria-hidden="true" className="my-6 border-0 border-t border-soft-hairline" />

			<div className="flex flex-col gap-3">
				<p className="font-mono text-sm text-faded-sumi">
					Rating breakdown
				</p>
				<DrillResultBar
					missed={metrics.missed}
					hesitated={metrics.hesitated}
					remembered={metrics.remembered}
					total={attempts.length}
				/>
			</div>
		</SectionCard>
	);
}

// ── Cards list card ─────────────────────────────────────────────────────────
// Mirrors review's WeakSpotsCard: SectionCard chrome with a divide-y list
// inside. Drill version lists each attempt (sorted: missed first, then
// hesitated, then remembered).

function CardsListCard({
	attempts,
	queueLength,
}: {
	attempts: readonly DrillAttemptRecord[];
	queueLength: number;
}): React.JSX.Element {
	const sorted = [...attempts].sort((a, b) => attemptPriority(a) - attemptPriority(b));
	const finished = attempts.length === queueLength;
	return (
		<SectionCard
			id="drill-summary-cards"
			kanji="札"
			label="Cards"
			count={attempts.length}
			description={finished ? "In the order you answered, weakest first." : `${attempts.length} of ${queueLength} rated before exit.`}
		>
			<ul role="list" className="divide-y divide-soft-hairline">
				{sorted.map(attempt => (
					<li
						key={attempt.eventId}
						className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0"
					>
						<p className="text-sm text-sumi-ink">
							<span
								className={cn(
									"font-mono text-sm",
									attempt.result === "missed" && "text-inari-vermillion-deep",
									attempt.result === "hesitated" && "text-jlpt-beyond-amber-warn",
									attempt.result === "remembered" && "text-jlpt-n5-fresh-leaf",
								)}
							>
								{attempt.result === "missed" ? "Missed" : attempt.result === "hesitated" ? "Hesitated" : "Remembered"}
							</span>
							<span aria-hidden="true" className="mx-2 text-faded-sumi">·</span>
							<span className="font-mono text-sm text-faded-sumi">
								{formatResponseTime(attempt.responseTimeMs)}
							</span>
						</p>
						<p className="font-mono text-sm text-faded-sumi">
							<Time value={attempt.answeredAt}>{new Date(attempt.answeredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</Time>
						</p>
					</li>
				))}
			</ul>
		</SectionCard>
	);
}

// ── Drill rating breakdown bar ──────────────────────────────────────────────
// 3-channel stacked bar. Visually rhymes with review's
// RatingDistributionBar but with the drill's vocabulary.

function DrillResultBar({
	missed,
	hesitated,
	remembered,
	total,
}: {
	missed: number;
	hesitated: number;
	remembered: number;
	total: number;
}): React.JSX.Element {
	const safeTotal = Math.max(total, 1);
	const segments = [
		{ label: "Missed", count: missed, color: "var(--color-rating-again)" },
		{ label: "Hesitated", count: hesitated, color: "var(--color-rating-hard)" },
		{ label: "Remembered", count: remembered, color: "var(--color-rating-good)" },
	];
	return (
		<div className="flex flex-col gap-3">
			<div
				role="img"
				aria-label={`Missed ${missed}, hesitated ${hesitated}, remembered ${remembered} of ${total}`}
				className="flex h-3 w-full overflow-hidden rounded-xs bg-cream-inset"
			>
				{segments.map(seg => (
					<div
						key={seg.label}
						style={{ width: `${(seg.count / safeTotal) * 100}%`, backgroundColor: seg.color }}
					/>
				))}
			</div>
			<dl className="grid grid-cols-3 gap-x-3 text-center">
				{segments.map(seg => (
					<div key={seg.label} className="flex flex-col gap-0.5">
						<dt className="font-mono text-sm text-faded-sumi">
							{seg.label}
						</dt>
						<dd className="font-display text-lg leading-none tabular-nums text-sumi-ink">
							{seg.count}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

interface DerivedMetrics {
	practiced: number;
	firstPassRecall: number;
	remembered: number;
	hesitated: number;
	missed: number;
	medianRtMs: number | null;
}

function deriveMetrics(attempts: readonly DrillAttemptRecord[]): DerivedMetrics {
	if (attempts.length === 0) {
		return { practiced: 0, firstPassRecall: 0, remembered: 0, hesitated: 0, missed: 0, medianRtMs: null };
	}
	const seen = new Set<string>();
	let firstPassRecall = 0;
	let missed = 0;
	let hesitated = 0;
	let remembered = 0;
	const rt: number[] = [];
	for (const a of attempts) {
		const first = !seen.has(a.sessionCardId);
		seen.add(a.sessionCardId);
		rt.push(a.responseTimeMs);
		if (a.result === "missed")
			missed++;
		if (a.result === "hesitated")
			hesitated++;
		if (a.result === "remembered") {
			remembered++;
			if (first)
				firstPassRecall++;
		}
	}
	return {
		practiced: seen.size,
		firstPassRecall,
		remembered,
		hesitated,
		missed,
		medianRtMs: rt.length === 0 ? null : median(rt),
	};
}

interface ClosurePick {
	kanji: string;
	label: string;
	headline: string;
	subcopy?: string;
	rationale: string;
}

function pickClosure(m: DerivedMetrics, exitedEarly: boolean): ClosurePick {
	if (exitedEarly) {
		return {
			kanji: "畢",
			label: "Drill ended",
			headline: "You stepped away early.",
			subcopy: "No problem. The cards you rated still tell you something useful.",
			rationale: "Your review schedule is untouched. Come back to drill when the moment is right.",
		};
	}
	if (m.missed === 0 && m.hesitated === 0) {
		return {
			kanji: "☆",
			label: "Drill closed",
			headline: "Steady all the way through.",
			subcopy: "Every card came back to you without hesitation.",
			rationale: "These weak spots are looking stable. Consider resolving the ones that feel done.",
		};
	}
	if (m.missed > m.remembered) {
		return {
			kanji: "苦",
			label: "Drill closed",
			headline: "A tough one. These need more time.",
			subcopy: "More misses than hits. The drill is doing its job by surfacing them.",
			rationale: "Run another short drill in a day or two. Repetition is the cure.",
		};
	}
	if (m.hesitated > m.missed + m.remembered / 2) {
		return {
			kanji: "思",
			label: "Drill closed",
			headline: "Lots of thinking, less recall.",
			subcopy: "You recovered most cards, but they took work.",
			rationale: "Hesitated cards are on the edge. A drill or two more should firm them up.",
		};
	}
	return {
		kanji: "良",
		label: "Drill closed",
		headline: "Solid work on a tough pile.",
		subcopy: "A mixed but balanced session.",
		rationale: "Keep the daily reviews going; drill the ones that still feel shaky.",
	};
}

function buildDiagnosis(m: DerivedMetrics, totalAttempts: number): { lead: string; aside: string | null } {
	if (totalAttempts === 0)
		return { lead: "No attempts to analyze.", aside: null };
	const recallPct = Math.round((m.remembered / totalAttempts) * 100);
	const lead = `You remembered ${m.remembered} of ${totalAttempts} attempts (${recallPct}%). First-pass recall: ${m.firstPassRecall} of ${m.practiced} cards.`;
	if (m.missed > 0) {
		return { lead, aside: `${m.missed} ${m.missed === 1 ? "card still needs" : "cards still need"} more time. They'll surface again as weak spots.` };
	}
	if (m.hesitated > 0) {
		return { lead, aside: `${m.hesitated} hesitated ${m.hesitated === 1 ? "card is" : "cards are"} on the edge. One more drill should settle them.` };
	}
	return { lead, aside: null };
}

function attemptPriority(a: DrillAttemptRecord): number {
	if (a.result === "missed")
		return 0;
	if (a.result === "hesitated")
		return 1;
	return 2;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
	}
	return sorted[mid] ?? 0;
}

function formatResponseTime(ms: number): string {
	if (ms < 1000)
		return `${ms}ms`;
	const s = Math.round(ms / 100) / 10;
	return `${s}s`;
}
