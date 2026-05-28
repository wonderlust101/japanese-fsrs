import type { CumulativeDueDay, IntervalBucket, OverdueImpact } from "./types";

import { ModuleError } from "@/components/ui/ModuleError";
import { SectionCard } from "@/components/ui/SectionCard";
import { CumulativeDueCurve } from "./cumulative-due-curve";
import { IntervalHistogram } from "./interval-histogram";
import { OverdueImpactCallout } from "./overdue-impact-callout";
import { STATISTICS_SECTIONS_BY_ID } from "./sections";
import { StatisticsSection } from "./statistics-section";

interface SchedulingSectionProps {
	intervals: ReadonlyArray<IntervalBucket>;
	cumulative: ReadonlyArray<CumulativeDueDay>;
	overdue: OverdueImpact;
	intervalsError?: boolean;
	onRetryIntervals?: () => void;
	scheduleError?: boolean;
	onRetrySchedule?: () => void;
}

const SECTION = STATISTICS_SECTIONS_BY_ID.scheduling;

export function SchedulingSection({
	intervals,
	cumulative,
	overdue,
	intervalsError = false,
	onRetryIntervals,
	scheduleError = false,
	onRetrySchedule,
}: SchedulingSectionProps): React.JSX.Element {
	return (
		<StatisticsSection section={SECTION}>
			<div className="flex flex-col gap-y-6 lg:gap-y-6">
				<SectionCard
					kanji="間"
					label="Interval distribution"
					description="How your collection is spread across review-interval buckets."
				>
					{intervalsError
						? <ModuleError label="the interval distribution" onRetry={onRetryIntervals ?? (() => {})} />
						: <IntervalHistogram buckets={intervals} />}
				</SectionCard>
				<SectionCard
					kanji="積"
					label="Cumulative due"
					description={`Total cards becoming due as the next ${cumulative.length} days roll forward.`}
				>
					{scheduleError
						? <ModuleError label="the due forecast" onRetry={onRetrySchedule ?? (() => {})} />
						: <CumulativeDueCurve data={cumulative} />}
				</SectionCard>
				{scheduleError
					? <ModuleError label="overdue impact" onRetry={onRetrySchedule ?? (() => {})} />
					: <OverdueImpactCallout data={overdue} />}
			</div>
		</StatisticsSection>
	);
}
