"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { KitsuneEmptyState } from "@/components/ui/KitsuneEmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Time } from "@/components/ui/Time";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useStatisticsDevState } from "@/dev/panels/insights-statistics";
import { getProfileAction } from "@/lib/actions/profile.actions";
import { useAnalyticsDashboard } from "@/lib/api/analytics";

import { queryKeys } from "@/lib/api/queryKeys";
import { useReviewForecast } from "@/lib/api/reviews";
import { InsightsErrorAlert } from "../../_components/InsightsErrorAlert";
import { INSIGHTS_HEADER_PADDING_CLASS, InsightsPageShell } from "../../_components/InsightsPageShell";
import { ActivitySection } from "./ActivitySection";
import { adaptLiveStatistics, hasMeaningfulData } from "./adapt-live";
import { CardsSection } from "./CardsSection";
import { FsrsSection } from "./FsrsSection";
import { RetentionSection } from "./RetentionSection";
import { SchedulingSection } from "./SchedulingSection";

import { SectionCollapseProvider } from "./section-collapse";
import {
	useStatisticsDecks,
	useStatisticsDistributions,
	useStatisticsMaturityHistory,
} from "./statistics-queries";
import { StatisticsSectionTabs } from "./StatisticsSectionTabs";

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
			/>
		</div>
	);
}

/**
 * Statistics container. Renders chrome (TopBar + PageHeader + sticky section
 * tabs) and the five sections in order. Data flows from the live insights /
 * analytics endpoints (dashboard + maturity-history + decks + forecast +
 * profile); the dev panel's fixture data, when selected, overrides the live
 * inputs so designers can preview every state in development without
 * leaving the route.
 */
export function StatisticsView(): React.JSX.Element {
	const dev = useStatisticsDevState();
	const isDev = process.env.NODE_ENV === "development";

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
			decks: decksQuery.data?.items,
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

	// Forced dev states override live state classification entirely.
	if (dev.forcedState === "error") {
		return (
			<PageShell>
				<StatisticsErrorAlert onRetry={() => { void dashboardQuery.refetch(); }} />
			</PageShell>
		);
	}
	if (dev.forcedState === "loading") {
		return (
			<PageShell header={null}>
				<PageLoader />
			</PageShell>
		);
	}

	const isLoading
		= dev.fixtureData === null
			&& (dashboardQuery.isLoading || maturityHistoryQuery.isLoading || forecastQuery.isLoading);

	// Treat dashboard as the load-bearing query; the others either fall back
	// to empty (`apiCallSafe`) or aren't blocking (profile, maturity history).
	const isError = dev.fixtureData === null && dashboardQuery.isError;

	if (isError) {
		return (
			<PageShell>
				<StatisticsErrorAlert onRetry={() => { void dashboardQuery.refetch(); }} />
			</PageShell>
		);
	}

	if (isLoading) {
		return (
			<PageShell header={null}>
				<PageLoader />
			</PageShell>
		);
	}

	const data = dev.fixtureData ?? liveData;

	if (!hasMeaningfulData(data)) {
		return (
			<PageShell>
				<StatisticsEmpty isDev={isDev} />
			</PageShell>
		);
	}

	// Freshness reflects when the load-bearing query last resolved; suppressed
	// for dev fixtures (no live fetch behind them).
	const live = dev.fixtureData === null;
	const updatedAt = live ? dashboardQuery.dataUpdatedAt : null;

	// Per-source failure flags (fixtures never error). Each maps to the modules
	// it feeds, so a failed section shows a retry rather than looking empty.
	const distError = live && distributionsQuery.isError;
	const matError = live && maturityHistoryQuery.isError;
	const deckError = live && decksQuery.isError;
	const fcError = live && forecastQuery.isError;

	const retryDist = (): void => { void distributionsQuery.refetch(); };
	const retryMat = (): void => { void maturityHistoryQuery.refetch(); };
	const retryDeck = (): void => { void decksQuery.refetch(); };
	const retryFc = (): void => { void forecastQuery.refetch(); };

	return (
		<PageShell>
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
		</PageShell>
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

// ── Shared page shell ───────────────────────────────────────────────────────
// Wraps the shared <InsightsPageShell> with this page's TopBar + PageHeader so
// each return branch doesn't repeat the chrome wiring.

function PageShell({
	header = <StatisticsHeader />,
	children,
}: {
	/**
	 * Pass `null` to suppress the page header (e.g. while loading, so the
	 *  centered PageLoader owns the viewport instead of sitting below the
	 *  title + subtitle).
	 */
	header?: React.ReactNode;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<InsightsPageShell topBar={<StatisticsTopBar />} header={header}>
			{children}
		</InsightsPageShell>
	);
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
