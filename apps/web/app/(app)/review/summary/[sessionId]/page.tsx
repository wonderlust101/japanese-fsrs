"use client";

import type {
	SessionSummary,
	SessionWeakSpot,
} from "@fsrs-japanese/shared-types";
import type { FixturePattern } from "../_components/summary-fixtures";

import type { WeekRhythmState } from "@/app/(app)/today/_components/week-rhythm-strip";
import type { ActionRoute } from "@/lib/review/summary-pattern";
import { assertNever } from "@fsrs-japanese/shared-types";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "@/app/(app)/_components/page-frame";
import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarBackLink } from "@/app/(app)/_components/top-bar-back-link";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { buildDashboardCalendarContext } from "@/app/(app)/today/_components/today-calendar";
import { WeekRhythmStrip } from "@/app/(app)/today/_components/week-rhythm-strip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast, useToast } from "@/components/ui/Toast";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useReviewSummaryDevState } from "@/dev/panels/review-summary";
import { useDayReflectionQuery } from "@/lib/api/reflections";
import { useIncrementalSessionDiagnosis, useReviewForecast, useRollbackReviewMutation, useSessionSummary, useSubmitReview } from "@/lib/api/reviews";

import { readLastFinishedSession } from "@/lib/review/last-finished-session";

import {
	buildSummaryContent,

} from "@/lib/review/summary-pattern";

import {
	useSessionActions,
	useSessionHistory,
	useSessionId,
} from "@/stores/useReviewSessionStore";
import { ClosureCard, ClosureHeader } from "../_components/closure-card";
import { SessionDetailsCard } from "../_components/session-details-card";
import {
	SUMMARY_FIXTURE_KEYS,
	SUMMARY_FIXTURES,

} from "../_components/summary-fixtures";
import { WeakSpotsBacklogNudge } from "../_components/weak-spots-backlog-nudge";
import { WeakSpotsCard } from "../_components/weak-spots-card";

// Sentinel value used by the dev fixture URL `/review/summary/_fixture?fixture=<pattern>`.
// The page uses this to short-circuit all real API calls and render synthetic data.
// Must never appear as a real session UUID (guaranteed by the `_` prefix).
const FIXTURE_SENTINEL = "_fixture";

export default function ReviewSummaryPage(): React.JSX.Element {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { reset } = useSessionActions();

	// rawId is sourced from the dynamic route segment — available synchronously
	// at first render via useParams() without requiring a Suspense boundary or
	// waiting for a navigation transition to settle. This is the key fix for
	// the 2-second day-reflection start delay: useDayReflectionQuery's enabled
	// condition now resolves to true on the first render, so the network call
	// starts as soon as the summary page mounts rather than after useSearchParams
	// delivers the ID during a later re-render.
	const { sessionId: rawId } = useParams<{ sessionId: string }>();
	const endedEarly = searchParams.get("ended") === "early";
	const fixtureParam = searchParams.get("fixture");

	// Dev fixture short-circuit: when the route is /_fixture?fixture=<pattern> and
	// the app is not in production, render the matching synthetic summary. Lets
	// the dev dock preview every state without spinning a real session.
	const fixtureSummary = useMemo<SessionSummary | null>(() => {
		// Build-time gate in POSITIVE block form: webpack's ConstPlugin prunes the
		// fixture refs so the 439-line summary-fixtures module tree-shakes out of
		// the prod /review/summary chunk. (Early-return does NOT — webpack counts
		// the refs as live before the constant is folded.)
		if (process.env.NODE_ENV === "development" && rawId === FIXTURE_SENTINEL && fixtureParam !== null) {
			const key = fixtureParam as FixturePattern;
			if (new Set<FixturePattern>(SUMMARY_FIXTURE_KEYS).has(key))
				return SUMMARY_FIXTURES[key];
		}
		return null;
	}, [rawId, fixtureParam]);

	const usingFixture = fixtureSummary !== null;

	// Register the dev panel with the global dev dock. The panel renders the
	// fixture link grid; selection state mirrors the live `?fixture=` URL.
	useReviewSummaryDevState({
		active: usingFixture ? (fixtureParam as FixturePattern) : null,
	});

	// Local short-circuit: the session store still holds the finished session
	// in memory (phase === 'finished'). When `?ended=early` matches the local
	// session id AND no cards were rated, the API would round-trip to return
	// an empty payload (or a 404). Skip the call entirely and render from
	// local state — instant, and survives a backend outage.
	const localSessionId = useSessionId();
	const localSessionHistory = useSessionHistory();
	// Tab-scoped handoff: read after mount, never during render. Reading
	// sessionStorage in render diverges between the server (null) and the first
	// client paint (possibly a record), which would flip `skipApi` and the
	// rendered branch — a hydration mismatch on this dynamically-rendered route.
	// Starting null keeps SSR and the first client render in agreement.
	const [lastFinished, setLastFinished]
		= useState<ReturnType<typeof readLastFinishedSession>>(null);
	useEffect(() => {
		setLastFinished(readLastFinishedSession()); // eslint-disable-line react/set-state-in-effect -- reads the local-session handoff on mount; null on SSR keeps hydration in agreement
	}, []);
	const liveStoreSaysEmpty = rawId === localSessionId
		&& localSessionHistory.length === 0;
	const handoffSaysEmpty = lastFinished !== null
		&& lastFinished.sessionId === rawId
		&& lastFinished.historyCount === 0;
	const skipApi = !usingFixture
		&& endedEarly
		&& (liveStoreSaysEmpty || handoffSaysEmpty);

	// Guard: with a fixture sentinel in the URL but no active fixture (e.g.
	// direct navigation to /_fixture without a ?fixture= param), route back to
	// setup. In prod this path is dead; in dev it handles a stale URL.
	useEffect(() => {
		if (rawId === FIXTURE_SENTINEL && !usingFixture) {
			router.replace("/review/setup");
		}
	}, [rawId, usingFixture, router]);

	// Local-first: when the just-finished session is still in the store, derive a
	// provisional summary (correct totals / rating breakdown / time, no weak
	// spots) so the closing screen's numbers paint immediately while the server
	// summary loads. Only for the live, just-finished session (rawId matches the
	// store) — cold deep-links have no local history and fall back to the server
	// read's full-page loader.
	const localProvisional = useMemo<SessionSummary | undefined>(() => {
		if (usingFixture || skipApi)
			return undefined;
		if (rawId !== localSessionId || localSessionHistory.length === 0)
			return undefined;
		const ratingBreakdown = { again: 0, hard: 0, good: 0, easy: 0 };
		let totalTimeMs = 0;
		for (const entry of localSessionHistory) {
			ratingBreakdown[entry.rating] += 1;
			totalTimeMs += entry.reviewTimeMs ?? 0;
		}
		const totalCards = localSessionHistory.length;
		const accuracyPct = Math.round(((ratingBreakdown.good + ratingBreakdown.easy) / totalCards) * 1000) / 10;
		return { sessionId: rawId, totalCards, totalTimeMs, accuracyPct, nextDueAt: null, ratingBreakdown, weakSpots: [] };
	}, [usingFixture, skipApi, rawId, localSessionId, localSessionHistory]);

	// Persistence gate (optimistic-nav safety): the session client now navigates
	// here the instant the last card is rated — before that final submit has
	// necessarily persisted. Reading the server summary too early would return an
	// N-1 aggregate that sticks (the read is staleTime: Infinity). So for the live
	// just-finished session, hold the server read until the final write is
	// confirmed persisted — the last history entry carries a reviewLogId, attached
	// by useSubmitReview's hook-level onSuccess. Until then `localProvisional`
	// (full, correct numbers) renders via placeholderData. Cold deep-links /
	// refreshes (store reset → not the live session) read immediately.
	const isLiveSession = rawId === localSessionId;
	const lastWritePersisted = !isLiveSession
		|| (localSessionHistory.length > 0
			&& (localSessionHistory.at(-1)?.reviewLogId ?? null) !== null);
	const serverReadId = usingFixture || skipApi || !lastWritePersisted ? null : rawId;
	const query = useSessionSummary(serverReadId, { placeholderData: localProvisional });
	// True while the page is showing local-first numbers and awaiting the server
	// read. Drives the hero + action-label gating so pattern-derived copy (which
	// depends on the server-only weak-spot count) never flips mid-view.
	const showingProvisional = query.isPlaceholderData;
	const forecastQuery = useReviewForecast();

	// Post-session AI reflection over the user's local-day aggregate. Gated
	// off for fixture and ended-early surfaces — those render canned copy
	// and shouldn't spend the AI quota. The hook is sessionId-scoped so
	// each summary view fetches its own day's reflection independently.
	//
	// rawId !== FIXTURE_SENTINEL guards the edge case where useSearchParams
	// hasn't resolved yet and fixtureParam is briefly null — without it, the
	// query would fire with "_fixture" as the session ID and get a 404.
	const reflectionQuery = useDayReflectionQuery({
		sessionId: rawId,
		enabled: !usingFixture && !skipApi && rawId !== FIXTURE_SENTINEL,
	});

	// todayKey for WeekRhythmStrip — resolved client-side from the browser's
	// timezone so the chart aligns with the user's "today." `null` on first
	// render (SSR / hydration) keeps the strip in `loading` state until the
	// effect resolves it.
	const [todayKey, setTodayKey] = useState<string | null>(null);
	useEffect(() => {
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		setTodayKey(buildDashboardCalendarContext(new Date(), tz).todayKey); // eslint-disable-line react/set-state-in-effect -- resolves the browser-timezone todayKey on mount (client-only)
	}, []);

	// Synthetic empty-session payload used when the user ended early before
	// any reviews persisted. Mirrors the SessionSummary contract with zeros
	// so the rest of the page can render the ended-early pattern unchanged.
	const emptyEndedEarlySummary: SessionSummary = useMemo(() => ({
		sessionId: rawId,
		totalCards: 0,
		totalTimeMs: 0,
		accuracyPct: 0,
		nextDueAt: null,
		ratingBreakdown: { again: 0, hard: 0, good: 0, easy: 0 },
		weakSpots: [],
		userTotalSessions: 0,
		sessionsToday: 0,
	}), [rawId]);

	// Rollback wiring — only active for the just-finished session so the
	// affordance disappears on cold deep-links (where we don't have the
	// per-card review log id from the session store). Hooks declared up
	// here (above the early-return branches below) so the hook order is
	// stable across every render path.
	const rollbackMutation = useRollbackReviewMutation();
	// Re-apply mutation used by the Undo affordance on the rollback toast.
	// Submits the original rating again with a fresh idempotency key, which
	// the FSRS service handles cleanly because the card is currently in the
	// rolled-back (pre-review) state.
	const reapplyMutation = useSubmitReview();
	const { toast, showToast, dismissToast } = useToast();
	const reviewLogByCardId = useMemo(() => {
		if (rawId !== localSessionId)
			return new Map<string, string>();
		const map = new Map<string, string>();
		for (const entry of localSessionHistory) {
			if (entry.reviewLogId != null)
				map.set(entry.card.id, entry.reviewLogId);
		}
		return map;
	}, [rawId, localSessionId, localSessionHistory]);
	const [rolledBackIds, setRolledBackIds] = useState<ReadonlySet<string>>(() => new Set());

	const summary: SessionSummary | undefined = usingFixture
		? fixtureSummary
		: skipApi
			? emptyEndedEarlySummary
			: query.data;

	// Per-row incremental diagnosis: fires one diagnose call per undiagnosed
	// weak spot once the summary lands, patching each row into the summary
	// cache as it resolves (no batch wait, no refetch). Null sessionId on the
	// fixture / ended-early surfaces disables it — those ship pre-baked or no
	// diagnoses. Each WeakSpotRow renders its own "Diagnosing…" pulse until
	// patched.
	useIncrementalSessionDiagnosis(
		usingFixture || skipApi ? null : rawId,
		summary?.weakSpots,
	);

	if (!usingFixture && !skipApi && query.isLoading && summary === undefined) {
		return (
			<>
				<TopBar>
					<TopBarBackLink href="/today" ariaLabel="Back to Today" />
					<TopBarTitle kanji="済" label="Session summary" />
				</TopBar>
				<PageFrame desktopCentered><PageLoader /></PageFrame>
			</>
		);
	}

	// Error / no-data branches. The ended-early path is forgiving: the
	// summary endpoint may legitimately have no rows yet (race against the
	// last deferred submission) or none at all (no cards rated), and either
	// way the learner should leave on a calm note, not an error card.
	const apiUnavailable = !usingFixture && !skipApi && (query.isError || summary === undefined);
	if (apiUnavailable && !endedEarly) {
		return (
			<>
				<TopBar>
					<TopBarBackLink href="/today" ariaLabel="Back to Today" />
					<TopBarTitle kanji="済" label="Session summary" />
				</TopBar>
				<PageFrame desktopCentered>
					<div className="mx-auto w-full max-w-[640px]">
						<Card variant="default" stripeTone="error">
							<h1 className="font-display text-2xl text-sumi-ink">Couldn't load summary.</h1>
							<p className="mt-2 text-sm text-faded-sumi">
								Your reviews are saved. Open Today to continue, or refresh to try again.
							</p>
							<div className="mt-6">
								<Button variant="primary" onClick={() => router.push("/today")}>
									Back to Today
								</Button>
							</div>
						</Card>
					</div>
				</PageFrame>
			</>
		);
	}

	const resolved: SessionSummary = summary ?? emptyEndedEarlySummary;
	const content = buildSummaryContent(resolved, endedEarly || resolved.totalCards === 0);

	const showWeakSpots = content.showWeakSpots && resolved.weakSpots.length > 0;

	function handlePrimary(): void {
		runAction(content.primary.route);
	}

	function handleSecondary(): void {
		if (content.secondary === undefined)
			return;
		runAction(content.secondary.route);
	}

	function runAction(route: ActionRoute): void {
		reset();
		switch (route.kind) {
			case "today":
				router.push("/today");
				return;
			case "insights":
				router.push("/insights");
				return;
			case "repair": {
				// Aggregate repair has no single target; surface the weak-spots
				// overview where the user can pick which card to act on.
				router.push("/weak-spots");
				return;
			}
			case "review-weak-spots": {
				// Single-card repair routes to the card detail page, which now
				// hosts the Forget / Reschedule actions; multiples fall back to
				// the weak-spots list because there's no batch-repair view.
				if (route.cardIds.length === 1) {
					router.push(`/cards/${encodeURIComponent(route.cardIds[0] ?? "")}`);
				} else {
					router.push("/weak-spots");
				}
				return;
			}
			default:
				assertNever(route);
		}
	}

	function handleRollback(weakSpot: SessionWeakSpot): void {
		const logId = reviewLogByCardId.get(weakSpot.cardId);
		if (logId === undefined)
			return;
		// Capture the original rating from the local session history so the
		// Undo affordance can re-apply it without an extra fetch. Falls back
		// to a no-action toast when the entry is somehow missing (rare).
		const originalEntry = localSessionHistory.find(h => h.card.id === weakSpot.cardId);
		const originalRating = originalEntry?.rating;
		rollbackMutation.mutate(logId, {
			onSuccess: () => {
				setRolledBackIds((prev) => {
					const next = new Set(prev);
					next.add(weakSpot.cardId);
					return next;
				});
				if (originalRating !== undefined) {
					// Show toast with Undo button that re-applies the original rating.
					showToast("Review rolled back.", "info", {
						label: "Undo",
						onClick: () => {
							reapplyMutation.mutate(
								{ cardId: weakSpot.cardId, rating: originalRating, sessionId: rawId },
								{
									onSuccess: () => {
										setRolledBackIds((prev) => {
											const next = new Set(prev);
											next.delete(weakSpot.cardId);
											return next;
										});
										showToast("Review restored.", "info");
									},
									onError: () => {
										showToast("Couldn't restore that review.", "error");
									},
								},
							);
						},
					});
				} else {
					showToast("Review rolled back.", "info");
				}
			},
			onError: (err) => {
				showToast(err.message ?? "Couldn't roll back that review.", "error");
			},
		});
	}

	// WeekRhythmStrip wiring. Route-level wait-then-reveal (page-load uses
	// <PageLoader/>) keeps this from rendering until forecast resolves, so
	// only the error branch remains.
	const weekRhythmState: WeekRhythmState
		= forecastQuery.isError ? "error" : "default";
	const weekRhythmDays = forecastQuery.data?.items ?? [];
	const weekRhythmTodayKey = todayKey ?? "1970-01-01";

	const weekStrip = (
		<WeekRhythmStrip
			state={weekRhythmState}
			todayKey={weekRhythmTodayKey}
			apiDays={weekRhythmDays}
		/>
	);

	return (
		<>
			<TopBar>
				<TopBarBackLink href="/today" ariaLabel="Back to Today" />
				<TopBarTitle kanji="済" label="Session summary" />
			</TopBar>

			<PageFrame desktopCentered>
				<ClosureHeader
					content={content}
					userTotalSessions={resolved.userTotalSessions ?? 0}
					provisional={showingProvisional}
				/>

				<ClosureCard
					content={content}
					resolved={resolved}
					breakdown={resolved.ratingBreakdown}
					onPrimary={handlePrimary}
					onSecondary={handleSecondary}
					sessionsToday={resolved.sessionsToday ?? 1}
					actionsReady={!showingProvisional}
				/>

				{/* Side-by-side grid only at xl+ (≥1280px). At lg (1024–1280) and
                 below, the cards stack with Session details on top and Weak
                 spots below — flipping the DOM order via `order` utilities so
                 the diagnostic read leads on narrow desktop widths and the
                 actionable list follows. At xl+, the original 8/4 layout
                 restores with Weak spots on the left and Session details on
                 the right. The `flex flex-col` fallback below xl carries the
                 stack; `xl:grid` upgrades to grid above the breakpoint. */}
				<div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] xl:gap-8">
					{/* `[&>section]:h-full` forces any direct <section> child
                        (every SectionCard renders as <section>) to claim
                        the wrapper's full height, including the
                        WeekRhythmStrip which doesn't accept a className
                        prop. This guarantees both grid items stretch to
                        the tallest row sibling regardless of which
                        component is rendered inside. */}
					<div className="order-2 flex h-full flex-col xl:order-1 [&>section]:h-full">
						{showWeakSpots
							? (
									<WeakSpotsCard
										weakSpots={resolved.weakSpots}
										usingFixture={usingFixture}
										reviewLogByCardId={reviewLogByCardId}
										rolledBackIds={rolledBackIds}
										rollbackPendingCardId={rollbackMutation.isPending ? (rollbackMutation.variables ?? null) : null}
										onRollback={handleRollback}
									/>
								)
							: (
									weekStrip
								)}
					</div>
					<div className="order-1 flex h-full flex-col xl:order-2 [&>section]:h-full">
						<SessionDetailsCard
							content={content}
							reflectionBody={reflectionQuery.data?.body}
							reflectionLoading={reflectionQuery.isLoading}
						/>
					</div>
				</div>

				{showWeakSpots && weekStrip}

				{!usingFixture && <WeakSpotsBacklogNudge />}

				{toast !== null && (
					<Toast
						key={toast.key}
						message={toast.message}
						kind={toast.kind}
						onDismiss={dismissToast}
					/>
				)}
			</PageFrame>
		</>
	);
}
