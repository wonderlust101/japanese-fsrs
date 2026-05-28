"use client";

import type { ApiDeck, ApiDueCard } from "@fsrs-japanese/shared-types";
import type { DeckRow } from "./setup-deck-list";
import type { QueueBreakdown } from "@/lib/review/queue-classify";
import type { SessionTuning } from "@/stores/useSessionTuningStore";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { MobileStickyActionBar } from "@/app/(app)/_components/mobile-sticky-action-bar";
import { PageFrame } from "@/app/(app)/_components/page-frame";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueueErrorPane } from "@/components/ui/QueueErrorPane";
import { QuietLink } from "@/components/ui/QuietLink";
import { SectionCard } from "@/components/ui/SectionCard";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useReviewSetupDevState } from "@/dev/panels/review-setup";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useDecks } from "@/lib/api/decks";
import { useDueCards } from "@/lib/api/reviews";
import { inferDeckLevel } from "@/lib/deck-level";
import {
	estimateSessionSeconds,
	formatSessionEstimate,
} from "@/lib/review/estimate-time";

import {
	classifyCard,
	countQueueBreakdown,
	priorityForKind,

} from "@/lib/review/queue-classify";
import { cn } from "@/lib/utils";

import { useSessionActions } from "@/stores/useReviewSessionStore";
import {
	useSessionTuningStore,

} from "@/stores/useSessionTuningStore";

import {
	activeBaseline,
	tuningDiffersFromBaseline,
	useTuningDefaultsStore,
} from "@/stores/useTuningDefaultsStore";
import { ConfirmPopover } from "./confirm-popover";
import { SetupControls } from "./setup-controls";
import { buildPreviewSnapshot } from "./setup-preview-data";
import { SetupSummary } from "./setup-summary";

interface SetupClientProps {
	initialTodayKey: string;
	initialTimeZone: string;
}

export function SetupClient({
	initialTodayKey,
	initialTimeZone,
}: SetupClientProps): React.JSX.Element {
	const router = useRouter();
	const { startSession } = useSessionActions();

	// ── Tuning state ─────────────────────────────────────────────────────────
	const tuning = useSessionTuningStore(useShallow((s): SessionTuning => ({
		includeNewCards: s.includeNewCards,
		sessionSize: s.sessionSize,
		includedDeckIds: s.includedDeckIds,
		reviewOrder: s.reviewOrder,
		newCardOrder: s.newCardOrder,
		overdueFirst: s.overdueFirst,
		timeboxMinutes: s.timeboxMinutes,
		buryRelated: s.buryRelated,
	})));
	const tuningActions = useSessionTuningStore(s => s.actions);

	// ── User-saved default tuning (localStorage) ─────────────────────────────
	// When set, becomes the active baseline for "modified" comparisons and the
	// target of Reset (instead of hardcoded DEFAULT_TUNING).
	const userDefault = useTuningDefaultsStore(s => s.userDefault);
	const tuningDefaultsActions = useTuningDefaultsStore(s => s.actions);
	const baseline = useMemo(() => activeBaseline(userDefault), [userDefault]);
	const modified = useMemo(
		() => tuningDiffersFromBaseline(tuning, baseline),
		[tuning, baseline],
	);

	// ── Dev toolbar (registered with the global dev dock) ────────────────────
	const { controls: devControls, previewActive } = useReviewSetupDevState();
	const previewSnapshot = useMemo(
		() => (process.env.NODE_ENV === "development" && previewActive ? buildPreviewSnapshot(devControls.state, devControls.queueShape) : null),
		[previewActive, devControls.state, devControls.queueShape],
	);

	// ── Connectivity ─────────────────────────────────────────────────────────
	const isOnline = useOnlineStatus();

	// ── Live data ────────────────────────────────────────────────────────────
	const dueQuery = useDueCards();
	// Setup needs every deck so the inclusion list and per-deck due-count
	// mapping cover the whole library, not just the first page. 500 is well
	// above any realistic personal library and below any server-side DoS
	// ceiling.
	const decksQuery = useDecks(500);

	const dueItems: ReadonlyArray<ApiDueCard> = dueQuery.data?.items ?? [];
	const allDecks: ReadonlyArray<ApiDeck> = decksQuery.data?.items ?? [];

	const liveBreakdown = useMemo<QueueBreakdown>(() => {
		if (dueQuery.data === undefined)
			return { reviewCount: 0, newCount: 0, backlogCount: 0 };
		return countQueueBreakdown(dueItems, initialTodayKey, initialTimeZone);
	}, [dueItems, initialTodayKey, initialTimeZone, dueQuery.data]);

	const liveDeckRows = useMemo<DeckRow[]>(() => {
		const counts = new Map<string, number>();
		for (const card of dueItems) {
			if (card.deckId === null)
				continue;
			counts.set(card.deckId, (counts.get(card.deckId) ?? 0) + 1);
		}
		return allDecks.map(d => ({
			id: d.id,
			name: d.name.trim() || "Untitled deck",
			level: inferDeckLevel(d),
			dueCount: counts.get(d.id) ?? 0,
		}));
	}, [allDecks, dueItems]);

	// ── Effective state ──────────────────────────────────────────────────────
	const isLoading = previewSnapshot?.isLoading ?? (dueQuery.isLoading || decksQuery.isLoading);
	const isError = previewSnapshot?.isError ?? (dueQuery.isError || decksQuery.isError);
	// First-time = truly empty library. Requires both no decks AND no due cards,
	// so a transient empty `decksQuery` (network blip, swallowed error, archived-
	// filter race) doesn't misclassify an active learner as brand-new.
	const isFirstTime = previewSnapshot?.isFirstTime ?? (
		!isLoading && !isError && allDecks.length === 0 && dueItems.length === 0
	);

	// Stale-data flag: quiet inline aizome label rendered after the
	// "Today's session" card label. Mirrors today-hero's HeroKicker flag
	// pattern. The dev preview's 'offline' state forces it on; otherwise
	// it tracks real network status via useOnlineStatus.
	const effectiveOnline = previewSnapshot !== null ? previewSnapshot.isOnline : isOnline;
	const staleFlag: string | undefined
		= !effectiveOnline ? "Showing the last saved queue" : undefined;

	const breakdown: QueueBreakdown = previewSnapshot?.breakdown ?? liveBreakdown;
	const deckRows: ReadonlyArray<DeckRow> = previewSnapshot?.decks ?? liveDeckRows;
	const totalDue = breakdown.reviewCount + breakdown.newCount + breakdown.backlogCount;

	const isNoReviews = previewSnapshot?.isCaughtUp ?? (
		!isLoading && !isError && !isFirstTime && deckRows.length > 0 && totalDue === 0
	);

	// ── Filter preview ───────────────────────────────────────────────────────
	// Shuffle seed is stable per mount, so toggling an unrelated tuning
	// (e.g. session size) doesn't re-randomize the shuffled order on every
	// recompute. The seed is regenerated only when the consumer explicitly
	// remounts the page.
	const shuffleSeedRef = useRef<number>(Math.floor(Math.random() * 2 ** 31));
	const previewCards = useMemo<ApiDueCard[]>(() => {
		if (previewSnapshot !== null)
			return [];
		return filterCardsForSession(dueItems, tuning, {
			todayKey: initialTodayKey,
			timeZone: initialTimeZone,
			decks: allDecks,
			shuffleSeed: shuffleSeedRef.current,
		});
	}, [dueItems, tuning, initialTodayKey, initialTimeZone, allDecks, previewSnapshot]);

	const previewBreakdown: QueueBreakdown = useMemo(() => {
		if (previewSnapshot !== null)
			return previewSnapshot.breakdown;
		return countQueueBreakdown(previewCards, initialTodayKey, initialTimeZone);
	}, [previewCards, initialTodayKey, initialTimeZone, previewSnapshot]);

	const previewTotal = previewBreakdown.reviewCount + previewBreakdown.newCount + previewBreakdown.backlogCount;

	const timeEstimate = useMemo(() => {
		if (previewSnapshot !== null) {
			const secs
				= previewBreakdown.reviewCount * 15
					+ previewBreakdown.newCount * 25
					+ previewBreakdown.backlogCount * 15;
			return formatSessionEstimate(secs);
		}
		return formatSessionEstimate(estimateSessionSeconds(previewCards));
	}, [previewSnapshot, previewBreakdown, previewCards]);

	// ── Handlers ─────────────────────────────────────────────────────────────
	const handleStart = useCallback((): void => {
		if (previewActive)
			return;
		if (previewCards.length === 0)
			return;
		startSession(previewCards);
		router.push("/review/session");
	}, [previewActive, previewCards, startSession, router]);

	const [refreshing, setRefreshing] = useState(false);
	const handleRefresh = useCallback(async (): Promise<void> => {
		if (refreshing)
			return;
		setRefreshing(true);
		try {
			await Promise.allSettled([dueQuery.refetch(), decksQuery.refetch()]);
		} finally {
			setRefreshing(false);
		}
	}, [dueQuery, decksQuery, refreshing]);

	// ── Action handlers ───────────────────────────────────────────────────────
	const handleResetToBaseline = useCallback((): void => {
		tuningActions.applyTuning(baseline);
	}, [tuningActions, baseline]);

	const handleSaveAsDefault = useCallback((): void => {
		tuningDefaultsActions.save(tuning);
	}, [tuningDefaultsActions, tuning]);

	// Power-user keyboard parity with /today:
	//   R / Enter — start the session (when previewable cards exist)
	//   S         — save current tuning as the user's default (when modified)
	// Suppressed when focus is inside a form control or a modifier key is held,
	// so segmented controls, checkboxes, and the deck list keep their behavior.
	useEffect(() => {
		function handleKey(event: KeyboardEvent): void {
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
				return;
			const target = event.target as HTMLElement | null;
			if (target !== null) {
				const tag = target.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
					return;
				if (target.isContentEditable)
					return;
			}
			const key = event.key.toLowerCase();
			if (key === "r" || key === "enter") {
				if (isLoading || previewActive || previewTotal === 0)
					return;
				event.preventDefault();
				handleStart();
				return;
			}
			if (key === "s") {
				if (!modified || previewActive)
					return;
				event.preventDefault();
				handleSaveAsDefault();
			}
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [
		handleStart,
		handleSaveAsDefault,
		isLoading,
		previewActive,
		previewTotal,
		modified,
	]);

	// ── Zero-state recovery hint ────────────────────────────────────────────
	// The user has decks and the underlying queue has cards (so this isn't
	// the celebrated NoReviewsState), but their current tuning produces an
	// empty preview. Tell them *which* filter to release. Each branch is
	// mutually exclusive in practice; we pick the most likely cause.
	const noReviewsHint: string | undefined = useMemo(() => {
		if (isFirstTime || isNoReviews || previewActive)
			return undefined;
		if (previewTotal > 0 || totalDue === 0)
			return undefined;
		if (tuning.includedDeckIds !== null && tuning.includedDeckIds.length === 0) {
			return "Every deck is off. Toggle one back on, or use the All bulk action above.";
		}
		if (tuning.overdueFirst && breakdown.backlogCount === 0) {
			return "No overdue cards in your queue. Uncheck \"Overdue first\" to study today’s reviews.";
		}
		if (!tuning.includeNewCards && breakdown.reviewCount === 0 && breakdown.backlogCount === 0) {
			return "Only new cards are due today. Turn on \"Include new cards\" to begin.";
		}
		return "Try widening your filters above.";
	}, [
		isFirstTime,
		isNoReviews,
		previewActive,
		previewTotal,
		totalDue,
		tuning.includedDeckIds,
		tuning.overdueFirst,
		tuning.includeNewCards,
		breakdown.backlogCount,
		breakdown.reviewCount,
	]);

	// ── Action area (shared between desktop summary and mobile sticky bar) ──
	const actions = (
		<ActionArea
			modified={modified}
			canStart={!isLoading && previewTotal > 0 && !previewActive}
			startLabel={
				isNoReviews
					? "Add Japanese"
					: previewTotal === 0
						? "Nothing to start"
						: `Start session · ${previewTotal} ${previewTotal === 1 ? "card" : "cards"}`
			}
			startHref={isNoReviews ? "/add" : undefined}
			onStart={handleStart}
			onReset={handleResetToBaseline}
			onSaveAsDefault={handleSaveAsDefault}
			{...(noReviewsHint !== undefined && { hint: noReviewsHint })}
		/>
	);

	if (isLoading) {
		return <PageLoader />;
	}

	if (isError) {
		return (
			<div className="relative isolate flex flex-1 flex-col">
				<QueueErrorPane
					onRefresh={() => void handleRefresh()}
					refreshing={refreshing}
				/>
			</div>
		);
	}

	return (
		<PageFrame desktopCentered>
			<PageHeader
				kanji="備"
				label="Review setup"
				title="Tune today's session."
				subtitle="Your deck defaults stay the same. These choices only apply today."
			/>

			{isFirstTime && <FirstTimeState />}

			{!isFirstTime && isNoReviews && <NoReviewsState />}

			{!isFirstTime && !isNoReviews && (
				<SetupSummary
					tone={isLoading ? "loading" : "default"}
					breakdown={previewBreakdown}
					timeLabel={timeEstimate.label}
					actions={actions}
					{...(staleFlag !== undefined && { flag: staleFlag })}
				/>
			)}

			{!isFirstTime && !isNoReviews && (
				<SetupControls
					tuning={tuning}
					onChange={tuningActions.set}
					decks={deckRows}
					totalDue={totalDue}
					disabled={isLoading}
				/>
			)}

			{/* Mobile sticky action bar. Hidden at lg+ (its default) — at lg the
          summary's internal actions appear at the bottom of the stacked
          summary card; at min-[1180px]+ the summary becomes the sticky
          sidebar and parks the start button there. */}
			{!isFirstTime && (
				<MobileStickyActionBar ariaLabel="Start review session">
					{actions}
				</MobileStickyActionBar>
			)}
		</PageFrame>
	);
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function ActionArea({
	modified,
	canStart,
	startLabel,
	startHref,
	onStart,
	onReset,
	onSaveAsDefault,
	hint,
}: {
	modified: boolean;
	canStart: boolean;
	startLabel: string;
	startHref?: string | undefined;
	onStart: () => void;
	onReset: () => void;
	onSaveAsDefault: () => void;
	/**
	 * Quiet one-line hint below the CTA when the user has tuned themselves
	 *  into a zero-card preview.
	 */
	hint?: string;
}): React.JSX.Element {
	// Local UI state for the confirm-reset popover and the "Saved" success
	// microcopy that briefly replaces the Save-as-default link.
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [savedFlash, setSavedFlash] = useState(false);
	// The Reset trigger anchors the floating confirm popover; the popover
	// measures this element's bounding rect to position itself.
	const resetButtonRef = useRef<HTMLButtonElement | null>(null);
	// Holds the active "Saved" flash timer so unmount can clear it. Without
	// this, navigating away within 2s leaves a pending state-setter that
	// fires against a stale closure.
	const savedFlashTimerRef = useRef<number | null>(null);

	useEffect(() => () => {
		if (savedFlashTimerRef.current !== null) {
			window.clearTimeout(savedFlashTimerRef.current);
		}
	}, []);

	function handleSaveClick(): void {
		onSaveAsDefault();
		setSavedFlash(true);
		if (savedFlashTimerRef.current !== null) {
			window.clearTimeout(savedFlashTimerRef.current);
		}
		savedFlashTimerRef.current = window.setTimeout(() => {
			setSavedFlash(false);
			savedFlashTimerRef.current = null;
		}, 2000);
	}

	function handleResetConfirm(): void {
		onReset();
		setConfirmOpen(false);
	}

	return (
		<div className="flex flex-col gap-2">
			{/* Single wrap-row: primary CTA on the left, secondary Save/Reset cluster
        sits to its right on widths where both fit. On narrow viewports the
        start button takes the whole row (flex-1) and the cluster wraps below. */}
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				{startHref !== undefined ? (
				// Link variant mirrors Button's `primary` palette per DESIGN.md
				// (bg-inari-vermillion → hover deepens). No transforms; flat CTA.
					<Link
						href={startHref}
						className={cn(
							"inline-flex h-12 flex-1 items-center justify-center rounded-xs px-6 text-base font-semibold sm:flex-none",
							"bg-inari-vermillion text-warm-paper-raised hover:bg-inari-vermillion-deep",
							"transition-colors duration-150 ease-out",
							"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
						)}
					>
						{startLabel}
					</Link>
				) : (
					<Button
						variant="primary"
						size="lg"
						onClick={onStart}
						disabled={!canStart}
						className="flex-1 sm:flex-none"
					>
						{startLabel}
					</Button>
				)}

				{/* Modifications cluster: Save-as-default + Reset.
          Mobile: `order-first` + `w-full` lifts the cluster above the
          Start CTA so the affirmative button stays the thumb-zone anchor
          while Save/Reset sit on a quieter row above. Desktop (sm+):
          `sm:order-none` + `sm:w-auto` restores the original "beside
          the CTA" inline layout. Hidden when tuning matches the active
          baseline. The confirm popover is portaled out of this subtree
          entirely, so opening it cannot shift any surrounding layout. */}
				{modified && (
					<div className="order-first w-full sm:order-none sm:w-auto flex flex-wrap items-center gap-2 text-sm">
						{/* aria-live wraps the swap so screen-reader users hear "Saved"
              when the link briefly replaces itself with the confirmation
              microcopy. Polite (not assertive) — this is a quiet success
              signal, not a warning. */}
						<span aria-live="polite" className="inline-flex items-center">
							{savedFlash
								? (
										<span className="inline-flex items-center pointer-coarse:min-h-11 font-mono text-sm text-inari-vermillion-deep">
											Saved
										</span>
									)
								: (
										<button
											type="button"
											onClick={handleSaveClick}
											className={cn(
												"inline-flex items-center rounded-xs px-2.5 py-1.5 text-sumi-ink pointer-coarse:min-h-11",
												"border border-soft-hairline bg-warm-paper-raised",
												"hover:border-faded-sumi hover:bg-cream-inset/60 cursor-pointer",
												"focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
												"transition-colors duration-150 ease-out",
											)}
										>
											Save as default
										</button>
									)}
						</span>
						<span aria-hidden="true" className="text-soft-hairline">·</span>
						<button
							ref={resetButtonRef}
							type="button"
							onClick={() => setConfirmOpen(v => !v)}
							className="inline-flex items-center pointer-coarse:min-h-11 text-faded-sumi underline decoration-soft-hairline underline-offset-4 hover:text-sumi-ink cursor-pointer"
						>
							Reset
						</button>
						<ConfirmPopover
							open={confirmOpen}
							anchorRef={resetButtonRef}
							headline="Reset tuning?"
							description="Returns every setting to your defaults for this session."
							confirmLabel="Reset"
							onConfirm={handleResetConfirm}
							onCancel={() => setConfirmOpen(false)}
						/>
					</div>
				)}
			</div>

			{/* Zero-state recovery hint. Live so the line is announced the
        moment the user tunes themselves into a no-card state. */}
			{hint !== undefined && (
				<p
					aria-live="polite"
					className="text-sm leading-relaxed text-faded-sumi"
				>
					{hint}
				</p>
			)}
		</div>
	);
}

function NoReviewsState(): React.JSX.Element {
	return (
		<SectionCard kanji="済" label="All clear">
			<div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
				<Logo size={80} showWordmark={false} />
				<h2
					id="setup-no-reviews-headline"
					className="break-words font-display text-hero leading-none text-sumi-ink"
				>
					Nothing scheduled.
					<span className="block text-faded-sumi font-normal">Add new Japanese, or rest for today.</span>
				</h2>
			</div>

			<p className="mt-5 max-w-measure break-words text-base text-faded-sumi leading-relaxed">
				Your queue is empty for today. Cards return when they are close to fading.
			</p>

			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
				<Link
					href="/add"
					className={cn(
						"inline-flex h-12 items-center justify-center rounded-xs px-6 text-base font-semibold",
						"bg-inari-vermillion text-warm-paper-raised hover:bg-inari-vermillion-deep",
						"transition-colors duration-150 ease-out",
						"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					)}
				>
					Add Japanese
				</Link>
				<QuietLink href="/today">Back to Today</QuietLink>
			</div>
		</SectionCard>
	);
}

function FirstTimeState(): React.JSX.Element {
	return (
		<SectionCard kanji="始" label="Begin">
			<div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
				<Logo size={80} showWordmark={false} />
				<div>
					<p
						lang="ja"
						className="font-display text-md leading-none text-faded-sumi sm:text-lg"
					>
						始めましょう。
					</p>
					<h2
						id="setup-first-time-headline"
						className="mt-2 break-words font-display text-hero leading-none text-sumi-ink"
					>
						Let&rsquo;s begin.
						<span className="block text-faded-sumi font-normal">
							Your first session is a few choices away.
						</span>
					</h2>
				</div>
			</div>

			<p className="mt-6 max-w-measure break-words text-base leading-relaxed text-faded-sumi">
				Pick a deck Tomo prepared for you, or bring the Japanese you&rsquo;re already studying. Either path opens the same way: calm, considered, no rush.
			</p>

			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
				<Link
					href="/decks"
					className={cn(
						"inline-flex h-12 items-center justify-center rounded-xs px-6 text-base font-semibold",
						"bg-inari-vermillion text-warm-paper-raised hover:bg-inari-vermillion-deep",
						"transition-colors duration-150 ease-out",
						"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					)}
				>
					Browse premade decks
				</Link>
				<QuietLink href="/add">Or add your own Japanese</QuietLink>
			</div>
		</SectionCard>
	);
}

// ── Pure filter ────────────────────────────────────────────────────────────

function filterCardsForSession(
	items: ReadonlyArray<ApiDueCard>,
	tuning: SessionTuning,
	ctx: {
		todayKey: string;
		timeZone: string;
		decks: ReadonlyArray<ApiDeck>;
		shuffleSeed: number;
	},
): ApiDueCard[] {
	const allowedDeckIds = tuning.includedDeckIds === null
		? new Set<string>(ctx.decks.map(d => d.id))
		: new Set<string>(tuning.includedDeckIds);

	const FSRS_NEW = 0;
	let pool: ApiDueCard[] = items.filter(c => c.deckId !== null && allowedDeckIds.has(c.deckId));

	if (!tuning.includeNewCards) {
		pool = pool.filter(c => c.state !== FSRS_NEW);
	}

	if (tuning.overdueFirst) {
		pool = pool.filter(c => classifyCard(c, ctx.todayKey, ctx.timeZone) === "backlog");
	}

	if (tuning.reviewOrder === "shuffle") {
		pool = shuffle(pool, ctx.shuffleSeed);
	} else {
		pool = [...pool].sort((a, b) => {
			const ka = classifyCard(a, ctx.todayKey, ctx.timeZone);
			const kb = classifyCard(b, ctx.todayKey, ctx.timeZone);
			return priorityForKind(ka) - priorityForKind(kb);
		});
	}

	if (tuning.newCardOrder === "shuffle" && tuning.includeNewCards) {
		const news = pool.filter(c => c.state === FSRS_NEW);
		const nonNews = pool.filter(c => c.state !== FSRS_NEW);
		// Offset seed so the new-card shuffle doesn't echo the review shuffle.
		pool = [...nonNews, ...shuffle(news, ctx.shuffleSeed ^ 0x9E3779B1)];
	}

	if (tuning.sessionSize > 0) {
		pool = pool.slice(0, tuning.sessionSize);
	}

	if (tuning.timeboxMinutes !== null) {
		const budgetSecs = tuning.timeboxMinutes * 60;
		const result: ApiDueCard[] = [];
		let used = 0;
		for (const c of pool) {
			const cost = c.state === FSRS_NEW ? 25 : 15;
			if (used + cost > budgetSecs)
				break;
			result.push(c);
			used += cost;
		}
		pool = result;
	}

	return pool;
}

// Mulberry32: a tiny seeded PRNG. Deterministic for a given seed so the
// shuffle preview stays stable across unrelated tuning recomputes; the
// caller varies the seed only when a fresh randomization is intended.
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6D2B79F5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(arr: ReadonlyArray<T>, seed: number): T[] {
	const result = [...arr];
	const rand = mulberry32(seed);
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j] as T, result[i] as T];
	}
	return result;
}
