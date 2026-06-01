"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useRef } from "react";

import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { KitsuneEmptyState } from "@/components/ui/KitsuneEmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Time } from "@/components/ui/Time";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useStatisticsDevState } from "@/dev/panels/insights-statistics";
import { useRevealScroll } from "@/hooks/use-reveal-scroll";
import { getProfileAction } from "@/lib/actions/profile.actions";

import { useAnalyticsDashboard } from "@/lib/api/analytics";
import { queryKeys } from "@/lib/api/queryKeys";
import { useReviewForecast } from "@/lib/api/reviews";
import { InsightsErrorAlert } from "../../_components/insights-error-alert";
import { INSIGHTS_CONTENT_FILL_CLASS, INSIGHTS_HEADER_PADDING_CLASS, InsightsPageShell } from "../../_components/insights-page-shell";
import { ActivitySection } from "./activity-section";
import { adaptLiveStatistics, hasMeaningfulData } from "./adapt-live";
import { CardsSection } from "./cards-section";
import { FsrsSection } from "./fsrs-section";
import { RetentionSection } from "./retention-section";
import { SchedulingSection } from "./scheduling-section";

import { SectionCollapseProvider } from "./section-collapse";
import {
	useStatisticsDecks,
	useStatisticsDistributions,
	useStatisticsMaturityHistory,
} from "./statistics-queries";
import { StatisticsSectionTabs } from "./statistics-section-tabs";

function StatisticsTopBar(): React.JSX.Element {
	return (
		<TopBar>
			<TopBarTitle kanji="数" label="Statistics" />
		</TopBar>
	);
}

function StatisticsHeader(): React.JSX.Element {
	return (
		<div className={INSIGHTS_HEADER_PADDING_CLASS}>
			<PageHeader
				kanji="数"
				label="Statistics"
				title="Statistics"
				subtitle="Detailed numbers from your practice: activity, retention, collection, schedule, and FSRS state. Grouped by question rather than by metric."
				revealLead
			/>
		</div>
	);
}

/** Shell — renders the TopBar before any data loads, wrapping content in a
 *  Suspense boundary so the TopBar always paints on first frame. */
export function StatisticsView(): React.JSX.Element {
	return (
		<InsightsPageShell topBar={<StatisticsTopBar />} header={<StatisticsHeader />}>
			<Suspense fallback={<div className={INSIGHTS_CONTENT_FILL_CLASS}><PageLoader /></div>}>
				<StatisticsContent />
			</Suspense>
		</InsightsPageShell>
	);
}

/**
 * Statistics content — owns data fetching, the five sections, and all state
 * branches. Rendered inside the shell's Suspense boundary so any suspension
 * only replaces the content area, not the top bar.
 */
function StatisticsContent(): React.JSX.Element {
	const dev = useStatisticsDevState();
	const isDev = process.env.NODE_ENV === "development";

	// Page-level section reveal (scroll mode — free, this route already ships
	// ScrollTrigger via the statistics charts). Header lead + the FIVE stat
	// `StatisticsSection`s cascade in (not the inner SectionCards — those would
	// over-animate). Attaches to the shell content container.
	const contentRef = useRef<HTMLDivElement | null>(null);

	const dashboardQuery = useAnalyticsDashboard();
	// Statistics-scoped strict queries: these surface real errors (unlike the
	// app-wide fail-open hooks) so each module can show a retry distinct from
	// a genuine empty state.
	const maturityHistoryQuery = useStatisticsMaturityHistory("90");
	const decksQuery = useStatisticsDecks(50);
	const forecastQuery = useReviewForecast();
	// Bundled rating + interval + stability + difficulty histograms.
	const distributionsQuery = useStatisticsDistributions();
	// Profile carries `retentionTarget` — the only piece of FSRS state we can
	// surface without a dedicated optimizer-state endpoint.
	const profileQuery = useQuery({
		queryKey: queryKeys.profile.me(),
		queryFn: getProfileAction,
		staleTime: 1000 * 60 * 60,
	});

	const liveData = useMemo(() => {
		return adaptLiveStatistics({
			dashboard: dashboardQuery.data,
			maturityHistory: maturityHistoryQuery.data,
			decks: decksQuery.data.items,
			forecast: forecastQuery.data?.items,
			retentionTarget: profileQuery.data?.retentionTarget,
			distributions: distributionsQuery.data,
		});
	}, [
		dashboardQuery.data,
		maturityHistoryQuery.data,
		decksQuery.data,
		forecastQuery.data,
		profileQuery.data,
		distributionsQuery.data,
	]);

	// Reveal readiness: the main (sections) branch only renders when not forced
	// loading/error, the load-bearing query resolved, and the data is meaningful.
	// Used purely as a `useReveal` re-run key so the cascade fires once the
	// `data-reveal` sections actually mount.
	// dashboard/maturity/distributions/decks are now useSuspenseQuery: their
	// isLoading/isError are always false. forecast stays as useQuery.
	const sectionsWillRender
		= dev.forcedState !== "error"
			&& dev.forcedState !== "loading"
			&& !(dev.fixtureData === null && forecastQuery.isLoading)
			&& hasMeaningfulData(dev.fixtureData ?? liveData);
	useRevealScroll(contentRef, { deps: [sectionsWillRender] });

	// Forced dev states (inside shell — no TopBar wrapper needed here).
	if (dev.forcedState === "error") {
		return <StatisticsErrorAlert onRetry={() => { void dashboardQuery.refetch(); }} />;
	}
	if (dev.forcedState === "loading") {
		return <div className={INSIGHTS_CONTENT_FILL_CLASS}><PageLoader /></div>;
	}

	// dashboard/maturity/distributions/decks are useSuspenseQuery — loading and
	// errors for those are handled by the Suspense/error boundaries. Forecast
	// (still useQuery) is the only source that can transition through loading
	// here, and that is folded into sectionsWillRender above for the reveal.
	const data = dev.fixtureData ?? liveData;

	if (!hasMeaningfulData(data)) {
		return (
			<div className="animate-memory-fade-in">
				<StatisticsEmpty isDev={isDev} />
			</div>
		);
	}

	// Freshness reflects when the load-bearing query last resolved; suppressed
	// for dev fixtures (no live fetch behind them).
	const live = dev.fixtureData === null;
	const updatedAt = live ? dashboardQuery.dataUpdatedAt : null;

	// Per-source failure flags. dist/mat/deck are useSuspenseQuery so their
	// errors propagate to the error boundary rather than to section-level states.
	const distError = false;
	const matError = false;
	const deckError = false;
	const fcError = live && forecastQuery.isError;

	// retryDist/Mat/Deck: error states are false (Suspense propagates to boundary)
	// but keep as valid refetch callbacks for section props.
	const retryDist = (): void => { void distributionsQuery.refetch(); };
	const retryMat = (): void => { void maturityHistoryQuery.refetch(); };
	const retryDeck = (): void => { void decksQuery.refetch(); };
	const retryFc = (): void => { void forecastQuery.refetch(); };

	return (
		<div ref={contentRef}>
			<SectionCollapseProvider>
				<StatisticsSectionTabs />

				{updatedAt !== null && updatedAt > 0 && (
					<p className="mt-3 text-right font-mono text-sm text-faded-sumi">
						Updated
						{" "}
						<Time value={updatedAt}>{formatRelative(updatedAt)}</Time>
					</p>
				)}

				{/* Retention leads (the outcome), then effort, collection, schedule,
            and the FSRS internals before the closing call to action. */}
				<div className="mt-6 flex flex-col gap-y-14 lg:mt-8 lg:gap-y-16">
					<RetentionSection
						days={data.retention}
						answers={data.answerButtons}
						answersError={distError}
						onRetryAnswers={retryDist}
					/>
					<ActivitySection
						days={data.activity}
						stats={data.activityStats}
					/>
					<CardsSection
						maturity={data.maturity}
						decks={data.decks}
						maturityError={matError}
						onRetryMaturity={retryMat}
						decksError={deckError}
						onRetryDecks={retryDeck}
					/>
					<SchedulingSection
						intervals={data.intervals}
						cumulative={data.cumulative}
						overdue={data.overdue}
						intervalsError={distError}
						onRetryIntervals={retryDist}
						scheduleError={fcError}
						onRetrySchedule={retryFc}
					/>
					<FsrsSection
						fsrs={data.fsrs}
						histogramsError={distError}
						onRetryHistograms={retryDist}
					/>
				</div>

			</SectionCollapseProvider>
		</div>
	);
}

/** Compact relative time for the freshness cue. */
function formatRelative(epochMs: number): string {
	const diffSec = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
	if (diffSec < 45)
		return "just now";
	const min = Math.round(diffSec / 60);
	if (min < 60)
		return `${min} min ago`;
	const hr = Math.round(min / 60);
	if (hr < 24)
		return `${hr} hr ago`;
	const days = Math.round(hr / 24);
	return days === 1 ? "yesterday" : `${days} days ago`;
}

// ── States ──────────────────────────────────────────────────────────────────

function StatisticsErrorAlert({ onRetry }: { onRetry: () => void }): React.JSX.Element {
	return <InsightsErrorAlert label="your statistics" onRetry={onRetry} />;
}

function StatisticsEmpty({ isDev }: { isDev: boolean }): React.JSX.Element {
	return (
		<KitsuneEmptyState
			ariaLabel="Statistics needs data"
			headline="Statistics fills in after a few weeks of practice."
			body={
				isDev
					? "No reviews yet (or pick a fixture from the dev panel in the bottom-left to preview each section)."
					: "Come back when you have a couple weeks of reviews. The page will show your activity, retention, collection, scheduling, and FSRS state."
			}
			ctaHref="/today"
			ctaLabel="Start a review"
		/>
	);
}
