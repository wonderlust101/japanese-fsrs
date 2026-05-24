'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuietLink } from '@/components/ui/QuietLink';
import { SectionCard } from '@/components/ui/SectionCard';
import { PageLoader } from '@/components/ui/TomoLoader';
import { cn } from '@/lib/utils';
import { RatingDistributionBar } from '@/components/review/summary/RatingDistributionBar';
import { TeacherQuotation } from '@/components/review/TeacherQuotation';
import { WeakSpotRow } from '@/components/review/summary/WeakSpotRow';
import { TopBar } from '@/app/(app)/_components/top-bar';
import { TopBarBackLink } from '@/app/(app)/_components/top-bar-back-link';
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title';
import { PageFrame } from '@/app/(app)/_components/page-frame';
import { WeekRhythmStrip, type WeekRhythmState } from '@/app/(app)/today/_components/week-rhythm-strip';
import { buildDashboardCalendarContext } from '@/app/(app)/today/_components/today-calendar';
import { useReviewForecast, useRollbackReviewMutation, useSessionSummary, useSubmitReview, useBatchDiagnoseSessionWeakSpots } from '@/lib/api/reviews';
import { useDayReflectionQuery } from '@/lib/api/reflections';
import { useUnresolvedWeakSpotCount } from '@/lib/api/weak-spots';
import { Toast, useToast } from '@/components/ui/Toast';
import {
    useSessionActions,
    useSessionHistory,
    useSessionId
} from '@/stores/useReviewSessionStore';
import {
    buildSummaryContent,
    type ActionRoute,
    type SummaryContent
} from '@/lib/review/summary-pattern';
import { readLastFinishedSession } from '@/lib/review/last-finished-session';

import { useReviewSummaryDevState } from '@/dev/panels/review-summary';

import {
    SUMMARY_FIXTURES,
    SUMMARY_FIXTURE_KEYS,
    FIXTURE_MEANINGS,
    type FixturePattern
} from './_components/summary-fixtures';

import type {
    SessionWeakSpot,
    SessionSummary
} from '@fsrs-japanese/shared-types';

const FIXTURE_KEY_SET = new Set<FixturePattern>(SUMMARY_FIXTURE_KEYS);

function formatTime(ms: number): string {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function ReviewSummaryPage(): React.JSX.Element {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {reset} = useSessionActions();

    const rawId = searchParams.get('id');
    const endedEarly = searchParams.get('ended') === 'early';
    const fixtureParam = searchParams.get('fixture');

    // Dev fixture short-circuit: when `?fixture=<pattern>` is present and the
    // app is not in production, render the matching synthetic summary. Lets
    // the dev dock preview every state without spinning a real session.
    const fixtureSummary = useMemo<SessionSummary | null>(() => {
        if (process.env.NODE_ENV === 'production') return null;
        if (fixtureParam === null) return null;
        const key = fixtureParam as FixturePattern;
        if (!FIXTURE_KEY_SET.has(key)) return null;
        return SUMMARY_FIXTURES[key];
    }, [fixtureParam]);

    const usingFixture = fixtureSummary !== null;

    // Register the dev panel with the global dev dock. The panel renders the
    // fixture link grid; selection state mirrors the live `?fixture=` URL.
    useReviewSummaryDevState({
        active : usingFixture ? (fixtureParam as FixturePattern) : null
    });

    // Local short-circuit: the session store still holds the finished session
    // in memory (phase === 'finished'). When `?ended=early` matches the local
    // session id AND no cards were rated, the API would round-trip to return
    // an empty payload (or a 404). Skip the call entirely and render from
    // local state — instant, and survives a backend outage.
    const localSessionId = useSessionId();
    const localSessionHistory = useSessionHistory();
    const lastFinished = useMemo(() => readLastFinishedSession(), []);
    const liveStoreSaysEmpty = rawId !== null
        && rawId === localSessionId
        && localSessionHistory.length === 0;
    const handoffSaysEmpty = rawId !== null
        && lastFinished !== null
        && lastFinished.sessionId === rawId
        && lastFinished.historyCount === 0;
    const skipApi = !usingFixture
        && endedEarly
        && (liveStoreSaysEmpty || handoffSaysEmpty);

    // Guard: with no session id and no fixture, route back to setup.
    useEffect(() => {
        if (usingFixture) return;
        if (rawId === null || rawId === '') {
            router.replace('/review/setup');
        }
    }, [usingFixture, rawId, router]);

    const query = useSessionSummary(usingFixture || skipApi ? null : rawId);
    const forecastQuery = useReviewForecast();

    // Post-session AI reflection over the user's local-day aggregate. Gated
    // off for fixture and ended-early surfaces — those render canned copy
    // and shouldn't spend the AI quota. The hook is sessionId-scoped so
    // each summary view fetches its own day's reflection independently.
    const reflectionQuery = useDayReflectionQuery({
        sessionId : rawId,
        enabled : !usingFixture && !skipApi && rawId !== null && rawId !== ''
    });

    // Batch-diagnose mutation used to populate per-row diagnoses for any
    // weak spots that don't have one yet. Auto-fired below after the
    // session summary resolves.
    const diagnoseMutation = useBatchDiagnoseSessionWeakSpots(rawId);

    // todayKey for WeekRhythmStrip — resolved client-side from the browser's
    // timezone so the chart aligns with the user's "today." `null` on first
    // render (SSR / hydration) keeps the strip in `loading` state until the
    // effect resolves it.
    const [todayKey, setTodayKey] = useState<string | null>(null);
    useEffect(() => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTodayKey(buildDashboardCalendarContext(new Date(), tz).todayKey);
    }, []);

    // Synthetic empty-session payload used when the user ended early before
    // any reviews persisted. Mirrors the SessionSummary contract with zeros
    // so the rest of the page can render the ended-early pattern unchanged.
    const emptyEndedEarlySummary: SessionSummary = useMemo(() => ({
        sessionId : rawId ?? '',
        totalCards : 0,
        totalTimeMs : 0,
        accuracyPct : 0,
        nextDueAt : null,
        ratingBreakdown : {again : 0, hard : 0, good : 0, easy : 0},
        weakSpots : [],
        userTotalSessions : 0,
        sessionsToday : 0
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
    const {toast, showToast, dismissToast} = useToast();
    const reviewLogByCardId = useMemo(() => {
        if (rawId === null || rawId !== localSessionId) return new Map<string, string>();
        const map = new Map<string, string>();
        for (const entry of localSessionHistory) {
            if (entry.reviewLogId != null) map.set(entry.card.id, entry.reviewLogId);
        }
        return map;
    }, [rawId, localSessionId, localSessionHistory]);
    const [rolledBackIds, setRolledBackIds] = useState<ReadonlySet<string>>(() => new Set());

    const summary: SessionSummary | undefined = usingFixture
        ? fixtureSummary
        : skipApi
            ? emptyEndedEarlySummary
            : query.data;

    // Auto-fire batch diagnose once the session summary lands, if any weak
    // spot is missing its AI diagnosis. Fires at most once per page mount;
    // the mutation hook + queryClient.invalidateQueries chain takes care of
    // re-rendering rows with fresh prose. Skipped for fixture/ended-early
    // surfaces since they ship pre-baked diagnoses.
    const diagnoseFiredRef = useRef(false);
    useEffect(() => {
        if (diagnoseFiredRef.current) return;
        if (usingFixture || skipApi) return;
        if (summary === undefined) return;
        const hasUndiagnosed = summary.weakSpots.some((w) => w.diagnosis === null);
        if (!hasUndiagnosed) return;
        diagnoseFiredRef.current = true;
        diagnoseMutation.mutate();
        // diagnoseMutation is intentionally omitted from deps: it is stable
        // across renders (React Query handles its identity), and the
        // diagnoseFiredRef guard above makes this effect fire at most once.
    }, [summary, usingFixture, skipApi]);

    if (!usingFixture && !skipApi && query.isLoading && summary === undefined) {
        return (
            <>
                <TopBar>
                    <TopBarBackLink href="/today" ariaLabel="Back to Today"/>
                    <TopBarTitle kanji="済" label="Session summary"/>
                </TopBar>
                <PageFrame desktopCentered><PageLoader/></PageFrame>
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
                    <TopBarBackLink href="/today" ariaLabel="Back to Today"/>
                    <TopBarTitle kanji="済" label="Session summary"/>
                </TopBar>
                <PageFrame desktopCentered>
                    <div className="mx-auto w-full max-w-[640px]">
                        <Card variant="default" stripeTone="error">
                            <h1 className="font-display text-2xl text-sumi-ink">Couldn’t load summary.</h1>
                            <p className="mt-2 text-sm text-faded-sumi">
                                Your reviews are saved. Open Today to continue, or refresh to try again.
                            </p>
                            <div className="mt-6">
                                <Button variant="primary" onClick={() => router.push('/today')}>
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

    const showProblemCards = content.showProblemCards && resolved.weakSpots.length > 0;

    function handlePrimary(): void {
        runAction(content.primary.route);
    }

    function handleSecondary(): void {
        if (content.secondary === undefined) return;
        runAction(content.secondary.route);
    }

    function runAction(route: ActionRoute): void {
        reset();
        switch (route.kind) {
            case 'today':
                router.push('/today');
                return;
            case 'insights':
                router.push('/insights');
                return;
            case 'repair': {
                // Aggregate repair has no single target; surface the weak-spots
                // overview where the user can pick which card to act on.
                router.push('/weak-spots');
                return;
            }
            case 'review-problem': {
                // Single-card repair routes to the card detail page, which now
                // hosts the Forget / Reschedule actions; multiples fall back to
                // the weak-spots list because there's no batch-repair view.
                if (route.cardIds.length === 1) {
                    router.push(`/cards/${encodeURIComponent(route.cardIds[0] ?? '')}`);
                } else {
                    router.push('/weak-spots');
                }
                return;
            }
        }
    }

    function handleRollback(weakSpot: SessionWeakSpot): void {
        const logId = reviewLogByCardId.get(weakSpot.cardId);
        if (logId === undefined) return;
        // Capture the original rating from the local session history so the
        // Undo affordance can re-apply it without an extra fetch. Falls back
        // to a no-action toast when the entry is somehow missing (rare).
        const originalEntry = localSessionHistory.find((h) => h.card.id === weakSpot.cardId);
        const originalRating = originalEntry?.rating;
        rollbackMutation.mutate(logId, {
            onSuccess : () => {
                setRolledBackIds((prev) => {
                    const next = new Set(prev);
                    next.add(weakSpot.cardId);
                    return next;
                });
                if (originalRating !== undefined) {
                    // Show toast with Undo button that re-applies the original rating.
                    showToast('Review rolled back.', 'info', {
                        label : 'Undo',
                        onClick : () => {
                            reapplyMutation.mutate(
                                {cardId : weakSpot.cardId, rating : originalRating, sessionId : rawId ?? undefined},
                                {
                                    onSuccess : () => {
                                        setRolledBackIds((prev) => {
                                            const next = new Set(prev);
                                            next.delete(weakSpot.cardId);
                                            return next;
                                        });
                                        showToast('Review restored.', 'info');
                                    },
                                    onError : () => {
                                        showToast("Couldn't restore that review.", 'error');
                                    }
                                }
                            );
                        }
                    });
                } else {
                    showToast('Review rolled back.', 'info');
                }
            },
            onError : (err) => {
                showToast(err.message ?? "Couldn't roll back that review.", 'error');
            }
        });
    }

    // WeekRhythmStrip wiring. Route-level wait-then-reveal (page-load uses
    // <PageLoader/>) keeps this from rendering until forecast resolves, so
    // only the error branch remains.
    const weekRhythmState: WeekRhythmState =
              forecastQuery.isError ? 'error' : 'default';
    const weekRhythmDays = forecastQuery.data?.items ?? [];
    const weekRhythmTodayKey = todayKey ?? '1970-01-01';

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
                <TopBarBackLink href="/today" ariaLabel="Back to Today"/>
                <TopBarTitle kanji="済" label="Session summary"/>
            </TopBar>

            <PageFrame desktopCentered>
                <ClosureHeader
                    content={content}
                    userTotalSessions={resolved.userTotalSessions ?? 0}
                />

                <ClosureCard
                    content={content}
                    resolved={resolved}
                    breakdown={resolved.ratingBreakdown}
                    onPrimary={handlePrimary}
                    onSecondary={handleSecondary}
                    sessionsToday={resolved.sessionsToday ?? 1}
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
                        {showProblemCards ? (
                            <ProblemCardsCard
                                weakSpots={resolved.weakSpots}
                                usingFixture={usingFixture}
                                reviewLogByCardId={reviewLogByCardId}
                                rolledBackIds={rolledBackIds}
                                rollbackPendingCardId={rollbackMutation.isPending ? (rollbackMutation.variables ?? null) : null}
                                onRollback={handleRollback}
                            />
                        ) : (
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

                {showProblemCards && weekStrip}

                {!usingFixture && <WeakSpotsBacklogNudge/>}

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

// ── Weak-spots backlog nudge ────────────────────────────────────────────────
// Calm cumulative-backlog signal at session close. Distinct from the in-card
// ProblemCardsCard above, which lists weak spots *triggered this session*;
// this nudge surfaces the total unresolved backlog (which may include earlier
// sessions' weak spots) and points to the drill setup so the learner can
// follow through without hunting through nav. Silent during loading; DOM-
// absent when no unresolved weak spots exist.

function WeakSpotsBacklogNudge(): React.JSX.Element | null {
    const {count, hasMore, isLoading} = useUnresolvedWeakSpotCount();
    if (isLoading) return null;
    if (count === 0) return null;

    const display = hasMore ? `${count}+` : String(count);
    const noun = count === 1 ? 'weak spot' : 'weak spots';

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-soft-hairline pt-6">
      <span
          lang="ja"
          aria-hidden="true"
          className="font-display text-lg leading-none text-inari-vermillion opacity-60"
      >
        弱
      </span>
            <p className="text-sm leading-relaxed text-faded-sumi">
                <span className="font-mono tabular-nums text-sumi-ink">{display}</span>{' '}
                {noun} still {count === 1 ? 'needs' : 'need'} a look.
            </p>
            <QuietLink
                href="/weak-spots/drill/setup"
                tone="brand"
                size="sm"
                trailingArrow
            >
                Drill them
            </QuietLink>
        </div>
    );
}

// ── Closure card ────────────────────────────────────────────────────────────
// Full-width SectionCard. Internal 2-col on lg+: text-left (kicker comes from
// SectionCard's own header, so the card body holds headline + receipt +
// rationale + action), mark-right at responsive 96 / 144px.

function ClosureHeader({
                           content,
                           userTotalSessions
                       }: {
    content: SummaryContent
    userTotalSessions: number
}): React.JSX.Element {
    // First-session copy variant — only when the user has exactly one
    // session in their history. Softer headline, orientation subtitle.
    const isFirstSession = userTotalSessions === 1;
    const kicker = isFirstSession
        ? {kanji : '初', label : 'First session'}
        : content.kicker;
    const headline = isFirstSession
        ? "You're underway."
        : content.heroHeadline;
    const subtitle = isFirstSession
        ? 'This page closes each session. The diagnosis below adapts to what just happened.'
        : content.heroSubcopy;

    return (
        <PageHeader
            kanji={kicker.kanji}
            label={kicker.label}
            title={headline}
            {...(subtitle !== undefined && {subtitle})}
        />
    );
}


function ClosureCard({
                         content,
                         resolved,
                         breakdown,
                         onPrimary,
                         onSecondary,
                         sessionsToday
                     }: {
    content: SummaryContent
    resolved: SessionSummary
    breakdown: {again: number; hard: number; good: number; easy: number}
    onPrimary: () => void
    onSecondary: () => void
    sessionsToday: number
}): React.JSX.Element {
    const cardsWord = resolved.totalCards === 1 ? 'card' : 'cards';
    const timeLabel = formatTime(resolved.totalTimeMs);

    return (
        <SectionCard
            id="summary-closure"
            kanji="今"
            label={sessionsToday > 1 ? `Today's sessions (${sessionsToday})` : "Today's session"}
            stripeTone="brand"
        >
            <div>
                <div className="min-w-0">
                    {/* Rating breakdown leads: the distribution is the richest
                     read on "how did the session go?", so it gets the prime
                     first-glance slot. Suppressed for zero-card sessions; an
                     empty distribution bar would just be visual noise. */}
                    {resolved.totalCards > 0 && (
                        <div className="flex flex-col gap-3">
                            <p className="font-mono text-sm text-faded-sumi">
                                Rating breakdown
                            </p>
                            <RatingDistributionBar
                                breakdown={breakdown}
                                total={resolved.totalCards}
                            />
                        </div>
                    )}

                    {/* Total + Time stats. Shares the Review Setup summary card's
                     visual language so the practice loop closes on the same
                     type sizes + grid it opened with. */}
                    <dl
                        className={cn(
                            'grid grid-cols-1 sm:grid-cols-2',
                            'gap-x-6 gap-y-4',
                            'max-w-[28rem]',
                            resolved.totalCards > 0 && 'mt-7'
                        )}
                    >
                        <ClosureStat
                            label="Total"
                            value={String(resolved.totalCards)}
                            suffix={cardsWord}
                        />
                        <ClosureStat
                            label="Time"
                            value={resolved.totalCards === 0 ? '0s' : timeLabel}
                        />
                    </dl>

                    <div className="mt-7 flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Button variant="primary" size="lg" onClick={onPrimary}>
                                {content.primary.label}
                            </Button>
                            {content.secondary !== undefined && (
                                <Button variant="editorial" size="lg" onClick={onSecondary}>
                                    {content.secondary.label}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </SectionCard>
    );
}

function ClosureStat({
                         label,
                         value,
                         suffix
                     }: {
    label: string
    value: string
    suffix?: string
}): React.JSX.Element {
    return (
        <div className="flex items-baseline gap-2 min-w-0 sm:justify-self-start">
            <dt className="font-mono text-sm text-faded-sumi">
                {label}
            </dt>
            <dd className="flex items-baseline gap-2 min-w-0">
        <span className="font-display text-stat tabular-nums text-sumi-ink">
          {value}
        </span>
                {suffix !== undefined && (
                    <span className="font-display text-sm text-faded-sumi">
            {suffix}
          </span>
                )}
            </dd>
        </div>
    );
}

// ── Session details card ────────────────────────────────────────────────────
// Two sub-sections inside one SectionCard, separated by a hairline. Top:
// "What to notice" diagnosis prose. Bottom: "Rating breakdown" with the
// existing distribution bar. The card's outer kanji header (詳 / Session
// details) labels the whole moment.

function SessionDetailsCard({
                                content,
                                reflectionBody,
                                reflectionLoading
                            }: {
    content: SummaryContent
    /** AI-generated post-session reflection body. When present, replaces the
     *  deterministic `content.diagnosisLead` inside the bracketed quote.
     *  When undefined and `reflectionLoading` is false, the rule-based lead
     *  is used as a silent fallback. */
    reflectionBody?: string | undefined
    reflectionLoading?: boolean
}): React.JSX.Element {
    // Prefer AI reflection when loaded. While loading on first fetch, show
    // a quiet skeleton — the deterministic lead is fallback, not a teaser,
    // so the user doesn't see prose A change to prose B mid-read.
    const showSkeleton = reflectionLoading === true && reflectionBody === undefined;
    const leadText = reflectionBody !== undefined && reflectionBody.length > 0
        ? reflectionBody
        : content.diagnosisLead;
    return (
        <SectionCard
            id="summary-details"
            kanji="詳"
            label="Session details"
            description="A closer read on how this session went."
            className="flex h-full flex-col"
        >
            <div className="flex flex-1 flex-col justify-center mb-5">
                {showSkeleton ? (
                    <ReflectionSkeleton/>
                ) : (
                    // Keyed wrapper triggers React's mount cycle when the lead
                    // text changes (skeleton → resolved AI body → fallback). The
                    // `animate-card-reveal` keyframe defined in globals.css is a
                    // 250ms cubic-bezier opacity+translate fade — the project's
                    // canonical reveal motion. Reduced-motion users get an instant
                    // cut via the standard `motion-reduce:animate-none` guard.
                    <div
                        key={leadText}
                        className="animate-card-reveal motion-reduce:animate-none"
                    >
                        <TeacherQuotation lead={leadText}/>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

// Soft skeleton placeholder shown only on the AI reflection's first load.
// Mirrors the bracket-and-prose silhouette of TeacherQuotation so the swap
// doesn't shift surrounding layout when the real text arrives. The faded
// background pulse is purely visual; the layout height is set by the same
// `min-h-[200px]` floor TeacherQuotation uses.
function ReflectionSkeleton(): React.JSX.Element {
    return (
        <div className="relative flex h-full min-h-[200px] flex-col justify-center py-6" aria-busy="true" aria-live="polite">
            <div className="mx-auto flex w-full max-w-measure-tight flex-col gap-3 px-4">
                <div className="h-4 w-5/6 animate-pulse rounded-xs bg-cream-inset/80 motion-reduce:animate-none"/>
                <div className="h-4 w-4/6 animate-pulse rounded-xs bg-cream-inset/80 motion-reduce:animate-none"/>
                <div className="h-4 w-3/6 animate-pulse rounded-xs bg-cream-inset/80 motion-reduce:animate-none"/>
            </div>
        </div>
    );
}

// ── Weak spots card ──────────────────────────────────────────────────────
// SectionCard with the weakSpot list inside. Divide-y between rows; no
// top/bottom borders since the card chrome already contains the list.

// Lapses-first ordering with recency as the tiebreaker. The list is now
// primarily a "what's failing hardest" view; within an identical lapse
// count, newer weak spots float above older ones so a learner can still
// tell what just slipped vs. what has been failing for weeks. Legacy
// payloads without `lapses` sort to the bottom (treated as 0).
function sortedWeakSpots(weakSpots: SessionWeakSpot[]): SessionWeakSpot[] {
    return [...weakSpots].sort((a, b) => {
        const aLapses = a.lapses ?? 0;
        const bLapses = b.lapses ?? 0;
        if (aLapses !== bLapses) return bLapses - aLapses;
        const aTime = Date.parse(a.createdAt);
        const bTime = Date.parse(b.createdAt);
        return bTime - aTime;
    });
}

function ProblemCardsCard({
                              weakSpots,
                              usingFixture,
                              reviewLogByCardId,
                              rolledBackIds,
                              rollbackPendingCardId,
                              onRollback
                          }: {
    weakSpots: SessionWeakSpot[]
    usingFixture: boolean
    reviewLogByCardId: ReadonlyMap<string, string>
    rolledBackIds: ReadonlySet<string>
    rollbackPendingCardId: string | null
    onRollback: (weakSpot: SessionWeakSpot) => void
}): React.JSX.Element {
    return (
        <SectionCard
            id="summary-problem-cards"
            kanji="困"
            label="Weak spots"
            description="Cards that keep slipping. Ordered by lapse count."
            count={weakSpots.length}
            stripeTone="error"
            kanjiTone="error"
            className="flex h-full flex-col"
        >
            {/* Tier-system explainer. Always-visible mono caption sitting just
             above the row list. Teaches the kanji-and-label combination so
             a first-time viewer doesn't have to infer Mark / Drift / Weak
             from lapse counts alone. `tabular-nums` keeps the ranges aligned
             across the three groups. */}
            <p
                aria-hidden="true"
                className="mt-3 font-mono text-sm text-faded-sumi tabular-nums"
            >
                <span className="text-sumi-ink">Mark</span> · 1–3 lapses
                <span className="mx-3 text-faded-sumi/60">·</span>
                <span className="text-warning">Drift</span> · 4–7
                <span className="mx-3 text-faded-sumi/60">·</span>
                <span className="text-inari-vermillion-deep">Weak</span> · 8+
            </p>

            <div className="mt-3 max-h-[22rem] overflow-y-auto pr-1">
                <ul className="flex flex-col gap-2">
                    {sortedWeakSpots(weakSpots).map((weakSpot) => {
                        const logId = reviewLogByCardId.get(weakSpot.cardId);
                        const alreadyRolled = rolledBackIds.has(weakSpot.cardId);
                        const canRollback = logId !== undefined && !alreadyRolled;
                        const rollbackPending = rollbackPendingCardId === logId;
                        return (
                            <li key={weakSpot.weakSpotId}>
                                <WeakSpotRow
                                    weakSpot={weakSpot}
                                    meaning={usingFixture ? FIXTURE_MEANINGS[weakSpot.cardId] : undefined}
                                    onRollback={canRollback ? onRollback : undefined}
                                    rollbackPending={rollbackPending}
                                />
                            </li>
                        );
                    })}
                </ul>
            </div>
        </SectionCard>
    );
}
