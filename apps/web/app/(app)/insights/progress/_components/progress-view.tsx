"use client";

import type {
	ApiAnalyticsDashboard,
	ApiMaturitySnapshot,
} from "@fsrs-japanese/shared-types";
import type { ProgressRangeKey } from "./progress-range";
import type { HeatmapCell, JlptCoverage, MatureMilestone, MaturePoint, ProgressData, ProgressSummary, RetentionPoint } from "./progress-types";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useMemo, useRef, useState } from "react";
import { TopBar } from "@/app/(app)/_components/top-bar";
import { TopBarTitle } from "@/app/(app)/_components/top-bar-title";
import { YearHeatmap } from "@/components/charts";
import { ModuleError } from "@/components/ui/ModuleError";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useProgressDevState } from "@/dev/panels/insights-progress";
import { useRevealScroll } from "@/hooks/use-reveal-scroll";
import { getProfileAction } from "@/lib/actions/profile.actions";
import { useAnalyticsDashboard } from "@/lib/api/analytics";

import { useMaturityHistory } from "@/lib/api/insights";

import { queryKeys } from "@/lib/api/queryKeys";
import { ChartRangeToggle } from "../../_components/chart-range-toggle";
import { InsightsErrorAlert } from "../../_components/insights-error-alert";
import { INSIGHTS_CONTENT_FILL_CLASS, INSIGHTS_HEADER_PADDING_CLASS, InsightsPageShell } from "../../_components/insights-page-shell";
import { JlptCoverageStrip } from "./jlpt-coverage-strip";
import { MatureStackedArea } from "./mature-stacked-area";
import { ProgressEmpty } from "./progress-empty";
import {
	buildConsistencyLine,
	buildHeaderLine,
	buildMatureLine,
	buildRetentionLine,
	classifyProgress,
} from "./progress-interpretation";
import {
	DEFAULT_PROGRESS_RANGE,
	PROGRESS_RANGES,
	rangeLabel,

} from "./progress-range";
import { ProgressSummaryStrip } from "./progress-summary-strip";
import {
	JLPT_TOTALS,

} from "./progress-types";
import { RetentionRibbonChart } from "./retention-ribbon-chart";

/**
 * Mature-card thresholds the Mature section marks with milestone dots. The
 * MatureStackedArea component renders one labelled dot per crossing, so any
 * snapshot whose matureCount first reaches a threshold contributes one dot
 * at that date. Mirrors the IA brief's "100, 250, 500, 1,000" plus the
 * higher thresholds we want available once a learner reaches the long tail.
 */
const MATURE_MILESTONES: ReadonlyArray<number> = [100, 250, 500, 1000, 2500, 5000];

// ── Page chrome ─────────────────────────────────────────────────────────────

function ProgressTopBar(): React.JSX.Element {
	return (
		<TopBar>
			<TopBarTitle kanji="歩" label="Progress" />
		</TopBar>
	);
}

interface ProgressHeaderProps {
	subtitle: string;
}

function ProgressHeader({ subtitle }: ProgressHeaderProps): React.JSX.Element {
	return (
		<div className={INSIGHTS_HEADER_PADDING_CLASS}>
			<PageHeader
				kanji="進"
				label="Progress"
				title="Progress"
				subtitle={subtitle}
				revealLead
			/>
		</div>
	);
}

// ── Live-data adapter ──────────────────────────────────────────────────────

/**
 * Convert the bundled `useAnalyticsDashboard` response + the Stage 9
 * `insights/maturity-history` snapshots into the ProgressData shape the
 * page components consume.
 *
 * Maturity history is optional — if it hasn't loaded yet (or returned an
 * empty list because the user has no history), the Mature card falls
 * back to its "a few more weeks of practice will fill this chart" note.
 *
 * `desiredRetention` is the learner's personal target from `profiles.
 * retention_target` (exposed via `GET /api/v1/profile`); the page falls
 * back to the FSRS default of 0.9 only if the profile query hasn't
 * resolved yet. `cardsAddedThisMonth` is the tz-aware month-to-date
 * count from the analytics dashboard envelope.
 */
function adaptDashboard(
	dashboard: ApiAnalyticsDashboard,
	maturityHistory: ReadonlyArray<ApiMaturitySnapshot>,
	desiredRetention: number,
	cardsAddedThisMonth: number,
): ProgressData {
	const heatmap: HeatmapCell[] = dashboard.heatmap.items.map(h => ({
		date: h.date,
		count: h.count,
		retention: h.retention / 100,
	}));

	const retention: RetentionPoint[] = heatmap.map(h => ({
		date: h.date,
		retention: h.count > 0 ? h.retention : null,
		reviews: h.count,
	}));

	const jlpt: JlptCoverage[] = dashboard.jlptGap.items
		.filter((j): j is typeof j & { jlptLevel: keyof typeof JLPT_TOTALS } => j.jlptLevel !== "beyond_jlpt")
		.map(j => ({
			level: j.jlptLevel,
			total: JLPT_TOTALS[j.jlptLevel],
			encountered: j.learned + j.due,
			owned: j.learned,
		}));

	const mature = adaptMaturityHistory(maturityHistory);
	const milestones = computeMilestones(mature);
	const latestMature = mature.length > 0
		? (mature[mature.length - 1]?.mature ?? 0)
		: 0;

	const recent30 = heatmap.slice(-30).filter(d => d.count > 0);
	const retention30d = recent30.length === 0
		? 0
		: recent30.reduce((acc, d) => acc + d.retention, 0) / recent30.length;
	const activeDaysLast30 = recent30.length;

	const summary: ProgressSummary = {
		matureCount: latestMature,
		retention30d,
		activeDaysLast30,
		cardsAddedThisMonth,
		daysSinceStart: heatmap.filter(d => d.count > 0).length,
	};

	const state = classifyProgress({
		retention,
		mature,
		desiredRetention,
		summary,
	});

	return {
		state,
		summary,
		retention,
		mature,
		milestones,
		jlpt,
		heatmap,
		desiredRetention,
	};
}

// ── Maturity-history adapter ────────────────────────────────────────────────

/**
 * Map the API's `(date, new, learning, review, relearning, mature)` snapshots
 * onto the local `MaturePoint` shape `(new, learning, young, mature)`. The
 * UI's "Learning" lane collapses learning + relearning; "Young" is the
 * non-mature subset of state=2 (review). The snapshot table's `reviewCount`
 * is total state=2; `matureCount` is the state=2 ≥ 21-day-scheduled subset,
 * so `young = max(0, reviewCount - matureCount)`. Sorted ascending by date
 * so the MatureStackedArea renders oldest → newest left-to-right.
 */
function adaptMaturityHistory(
	snapshots: ReadonlyArray<ApiMaturitySnapshot>,
): MaturePoint[] {
	return [...snapshots]
		.sort((a, b) => (a.date < b.date ? -1 : 1))
		.map(row => ({
			date: row.date,
			new: row.newCount,
			learning: row.learningCount + row.relearningCount,
			young: Math.max(0, row.reviewCount - row.matureCount),
			mature: row.matureCount,
		}));
}

/**
 * Compute milestone crossings: one dot per threshold the learner crossed,
 * dated to the first snapshot in which `mature` reached the threshold.
 * Snapshots are assumed sorted ascending by date (adaptMaturityHistory
 * sorts in place).
 */
function computeMilestones(series: ReadonlyArray<MaturePoint>): MatureMilestone[] {
	if (series.length === 0)
		return [];
	const out: MatureMilestone[] = [];
	for (const threshold of MATURE_MILESTONES) {
		const crossing = series.find(p => p.mature >= threshold);
		if (crossing === undefined)
			break;
		out.push({ count: threshold, date: crossing.date });
	}
	return out;
}

// ── View ───────────────────────────────────────────────────────────────────

/** Shell — renders the TopBar before any data loads and wraps the content in a
 *  Suspense boundary. TopBar is outside the boundary so it paints immediately. */
export function ProgressView(): React.JSX.Element {
	return (
		<InsightsPageShell topBar={<ProgressTopBar />}>
			<Suspense fallback={<div className={INSIGHTS_CONTENT_FILL_CLASS}><PageLoader /></div>}>
				<ProgressContent />
			</Suspense>
		</InsightsPageShell>
	);
}

/**
 * Inner content for /insights/progress. Five SectionCards stack vertically:
 * Summary, Retention, Mature, JLPT, Consistency. Rendered inside the shell's
 * Suspense boundary so any suspension only replaces the content area.
 */
function ProgressContent(): React.JSX.Element {
	const dev = useProgressDevState();
	const isDev = process.env.NODE_ENV === "development";
	// One range drives both time-series charts. The control lives in the
	// Retention card header; the Mature card echoes the value read-only.
	const [range, setRange] = useState<ProgressRangeKey>(DEFAULT_PROGRESS_RANGE);
	const dashboardQuery = useAnalyticsDashboard();
	// 365-day window so the Mature section's "All" range surfaces a full
	// year of pipeline history. Smaller ranges (30d/90d/6m/1y) inside the
	// chart slice this client-side.
	const maturityHistoryQuery = useMaturityHistory("365");
	// Profile carries the learner's personal `retentionTarget`. Default 0.9
	// until the query resolves so the chart never renders a missing line.
	const profileQuery = useQuery({
		queryKey: queryKeys.profile.me(),
		queryFn: getProfileAction,
		staleTime: 1000 * 60 * 60,
	});

	// Page-level section reveal (scroll mode — this route already ships
	// ScrollTrigger via the chart draw-on). Attaches to the shell content
	// container so the PageHeader lead + the 5 SectionCards cascade in. The hook
	// no-ops when the content/sections aren't mounted (loading/error/empty
	// branches), and reduced-motion renders everything at rest.
	const contentRef = useRef<HTMLDivElement | null>(null);

	const data = useMemo<ProgressData | null>(() => {
		if (dev.fixtureData !== null)
			return dev.fixtureData;
		// dashboardQuery.data and maturityHistoryQuery.data are always defined
		// (useSuspenseQuery guarantees it — the component suspends until both resolve).
		const desiredRetention = profileQuery.data?.retentionTarget ?? 0.9;
		return adaptDashboard(
			dashboardQuery.data,
			maturityHistoryQuery.data,
			desiredRetention,
			dashboardQuery.data.cardsAddedThisMonth,
		);
	}, [dev.fixtureData, dashboardQuery.data, maturityHistoryQuery.data, profileQuery.data]);

	// Page-level section reveal (scroll mode — this route already ships
	// ScrollTrigger via the chart draw-on). Attaches to the shell content
	// container so the PageHeader lead + the 5 SectionCards cascade in once the
	// data branch mounts. Re-runs when the SectionCard stack first renders
	// (keyed on data presence + state); a no-op in loading/error/empty branches
	// where no `data-reveal` nodes exist, and reduced-motion renders at rest.
	const contentReady = data !== null && data.state !== "limited";
	useRevealScroll(contentRef, { deps: [contentReady] });

	const defaultSubtitle = "What you've grown, where you stand, how you've been showing up.";

	// Forced dev states win first (inside shell — no TopBar wrapper needed here).
	if (dev.forcedState === "error") {
		return (
			<>
				<ProgressHeader subtitle={defaultSubtitle} />
				<InsightsErrorAlert
					label="your progress"
					onRetry={() => { void dashboardQuery.refetch(); }}
				/>
			</>
		);
	}
	if (dev.forcedState === "loading") {
		return <div className={INSIGHTS_CONTENT_FILL_CLASS}><PageLoader /></div>;
	}

	if (data === null || data.state === "limited") {
		return (
			<>
				<ProgressHeader subtitle={data === null ? defaultSubtitle : buildHeaderLine(data)} />
				<div className="animate-memory-fade-in">
					<ProgressEmpty
						activeDays={data?.retention.length ?? null}
						isDev={isDev && dev.fixtureData !== null}
					/>
				</div>
			</>
		);
	}

	const headerLine = buildHeaderLine(data);
	const hasMature = data.mature.length >= 14;
	// maturityHistoryQuery is now useSuspenseQuery — errors propagate to the
	// error boundary so this section-level error state is no longer reachable.
	const maturityError = false;

	return (
		<div ref={contentRef}>
			<ProgressHeader subtitle={headerLine} />
			{/* Outcomes tier: the "are you on track" story, full-width and leading. */}
			<div className="flex flex-col gap-y-8 lg:gap-y-10">
				<SectionCard
					id="progress-summary"
					kanji="要"
					label="Summary"
					description="A quiet read of where you stand today."
					chrome="chart"
					variant="chart"
					reveal
				>
					<ProgressSummaryStrip data={data} />
				</SectionCard>

				<SectionCard
					id="progress-retention"
					kanji="保"
					label="Retention"
					description={buildRetentionLine(data)}
					chrome="chart"
					variant="chart"
					reveal
					rightContent={(
						<ChartRangeToggle
							label="Time range for the retention and mature charts"
							options={PROGRESS_RANGES}
							value={range}
							onChange={setRange}
						/>
					)}
				>
					<RetentionRibbonChart
						series={data.retention}
						desiredRetention={data.desiredRetention}
						range={range}
					/>
				</SectionCard>

				<SectionCard
					id="progress-mature"
					kanji="熟"
					label="Mature growth"
					description={
						maturityError
							? "The maturity history could not be loaded."
							: hasMature
								? buildMatureLine(data)
								: "A few more weeks of practice will fill this chart."
					}
					chrome="chart"
					variant="chart"
					reveal
					rightContent={hasMature && !maturityError ? <RangeEcho rangeKey={range} /> : undefined}
				>
					{maturityError
						? (
								<ModuleError
									label="the maturity history"
									onRetry={() => { void maturityHistoryQuery.refetch(); }}
								/>
							)
						: hasMature
							? (
									<MatureStackedArea
										series={data.mature}
										milestones={data.milestones}
										range={range}
									/>
								)
							: (
									<MatureFallbackNote />
								)}
				</SectionCard>

				{/* Context tier: secondary read. JLPT coverage and the year heatmap
            each take their own full-width row so neither chart is cramped,
            matching the full-width rhythm of the outcomes tier above. */}
				<SectionCard
					id="progress-jlpt"
					kanji="級"
					label="JLPT coverage"
					description="A proportional read across the five levels."
					chrome="chart"
					variant="chart"
					reveal
				>
					<JlptCoverageStrip data={data} />
				</SectionCard>

				<SectionCard
					id="progress-consistency"
					kanji="続"
					label="Consistency"
					description={buildConsistencyLine(data)}
					chrome="chart"
					variant="chart"
					reveal
				>
					<YearHeatmap days={data.heatmap} />
				</SectionCard>
			</div>
		</div>
	);
}

// ── Auxiliary blocks ───────────────────────────────────────────────────────

/**
 * Read-only echo of the active page range, shown in the Mature card header.
 * The Mature chart follows the range set on the Retention card; this label
 * makes that coupling visible so the control never feels like it's acting at
 * a distance. Not a second control, just a mirror.
 */
function RangeEcho({ rangeKey }: { rangeKey: ProgressRangeKey }): React.JSX.Element {
	return (
		<span className="font-mono text-sm lowercase tracking-wide text-faded-sumi">
			range ·
			{" "}
			{rangeLabel(rangeKey).toLowerCase()}
		</span>
	);
}

function MatureFallbackNote(): React.JSX.Element {
	return (
		<div className="rounded-xs border border-dashed border-soft-hairline bg-cream-inset/50 px-5 py-6 text-sm leading-relaxed text-faded-sumi">
			<p className="text-sumi-ink/85">
				The maturity pipeline reads as new, learning, young, and mature
				counts stacked across each day.
			</p>
			<p className="mt-2">
				Once you have a couple weeks of reviews logged, this chart fills
				in, with milestone dots at 100, 250, 500, and 1,000 mature cards.
			</p>
		</div>
	);
}
