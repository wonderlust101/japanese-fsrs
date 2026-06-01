"use client";

import { useMemo, useRef } from "react";
import { KitsuneEmptyState } from "@/components/ui/KitsuneEmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/TomoLoader";
import { useForecastDevState } from "@/dev/panels/insights-forecast";

import { useRevealScroll } from "@/hooks/use-reveal-scroll";

import { useReviewForecast } from "@/lib/api/reviews";
import { InsightsErrorAlert } from "../../_components/insights-error-alert";
import { INSIGHTS_HEADER_PADDING_CLASS, InsightsPageShell } from "../../_components/insights-page-shell";

import { CatchUpPlannerCard } from "./catch-up-planner-card";
import { DeckContributorsCard } from "./deck-contributors-card";
import { NewCardImpactCard } from "./new-card-impact-card";
import { TimeEstimateCard } from "./time-estimate-card";
import { WorkloadCard } from "./workload-card";

function ForecastHeader(): React.JSX.Element {
	return (
		<div className={INSIGHTS_HEADER_PADDING_CLASS}>
			<PageHeader
				kanji="次"
				label="Looking ahead"
				title="Forecast"
				subtitle="What's landing on your schedule over the next few weeks, and how to plan around it."
				revealLead
			/>
		</div>
	);
}

/**
 * Container for /insights/forecast. Renders the page header and a vertical
 * stack of five SectionCard beats: upcoming workload, new-card impact,
 * catch-up planner, deck contributors, and time estimate. Each beat owns
 * its own data shape and rendering; this component only sequences them.
 *
 * Empty state: a centered kitsune accompanied by a short prose line,
 * mirroring the Overview's empty-state pattern but with forecast-specific
 * copy. Loading: a centered page loader. Error: shared retry alert.
 */
export function ForecastView(): React.JSX.Element {
	const forecastQuery = useReviewForecast();
	const dev = useForecastDevState();
	const items = useMemo(() => forecastQuery.data?.items ?? [], [forecastQuery.data]);

	const isError = dev.forcedState === "error" ? true : forecastQuery.isError;
	const isLoading = dev.forcedState === "loading" ? true : forecastQuery.isLoading;

	const hasAnyData = items.some(d => d.count > 0);
	const contentReady = !isError && !isLoading && hasAnyData;

	// Page-level section reveal (scroll mode — free, this route already ships
	// ScrollTrigger via the forecast charts). Header lead + the five forecast
	// SectionCards cascade in. Re-runs when the data branch first mounts; a no-op
	// in loading/error/empty branches (no `data-reveal` nodes), reduced-motion at
	// rest.
	const contentRef = useRef<HTMLDivElement | null>(null);
	useRevealScroll(contentRef, { deps: [contentReady] });

	if (isError) {
		return (
			<InsightsPageShell header={<ForecastHeader />}>
				<InsightsErrorAlert
					label="your forecast"
					onRetry={() => { void forecastQuery.refetch(); }}
				/>
			</InsightsPageShell>
		);
	}

	if (isLoading) {
		// `fill` centers the loader in the content viewport (header omitted) so it
		// owns the screen instead of sitting below the title + subtitle.
		return (
			<InsightsPageShell fill>
				<PageLoader />
			</InsightsPageShell>
		);
	}

	if (!hasAnyData) {
		return (
			<InsightsPageShell header={<ForecastHeader />}>
				<div className="animate-memory-fade-in">
					<ForecastEmpty />
				</div>
			</InsightsPageShell>
		);
	}

	return (
		<InsightsPageShell header={<ForecastHeader />} contentRef={contentRef}>
			{/* Single full-width stack, top to bottom: the "what's landing" story
          (upcoming load, new-card simulator, catch-up), then the deck
          contributors, and finally the time estimate on its own row. Every
          card holds the full content width so charts are never cramped. */}
			<div className="flex flex-col gap-y-8 lg:gap-y-10">
				<WorkloadCard forecast={items} />
				<NewCardImpactCard forecast={items} />
				<CatchUpPlannerCard forecast={items} />
				<DeckContributorsCard />
				<TimeEstimateCard forecast={items} />
			</div>
		</InsightsPageShell>
	);
}

// ── Empty state ─────────────────────────────────────────────────────────────

function ForecastEmpty(): React.JSX.Element {
	return (
		<KitsuneEmptyState
			ariaLabel="Forecast needs more data"
			headline="Your forecast takes shape after a few reviews."
			body="Once your first cards are scheduled, this page will show what’s landing each day, how new-card pace shifts the load, and where any backlog is hiding."
			ctaHref="/today"
			ctaLabel="Start a review"
		/>
	);
}
