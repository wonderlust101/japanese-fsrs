import type { ActivityDay, ActivityStats } from "./types";

import { YearHeatmap } from "@/components/charts";
import { SectionCard } from "@/components/ui/SectionCard";
import { ActivityStatsStrip } from "./ActivityStatsStrip";
import { STATISTICS_SECTIONS_BY_ID } from "./sections";
import { StatisticsSection } from "./StatisticsSection";

interface ActivitySectionProps {
	days: ReadonlyArray<ActivityDay>;
	stats: ActivityStats;
}

const SECTION = STATISTICS_SECTIONS_BY_ID.activity;

/**
 * Activity section. Stats strip across the top, year heatmap below.
 * Both inside a single SectionCard.
 */
export function ActivitySection({
	days,
	stats,
}: ActivitySectionProps): React.JSX.Element {
	return (
		<StatisticsSection section={SECTION}>
			<SectionCard kanji="動" label="Reviewed" omitTitle>
				<div className="flex flex-col gap-y-8 px-1 pb-1 pt-1">
					<ActivityStatsStrip stats={stats} />
					<YearHeatmap days={days} />
				</div>
			</SectionCard>
		</StatisticsSection>
	);
}
