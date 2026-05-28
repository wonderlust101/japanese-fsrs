import type { FsrsState } from "./types";

import { ModuleError } from "@/components/ui/ModuleError";
import { SectionCard } from "@/components/ui/SectionCard";
import { DesiredRetentionDial } from "./desired-retention-dial";
import { FsrsHistogram } from "./fsrs-histogram";
import { RetentionComparison } from "./retention-comparison";
import { STATISTICS_SECTIONS_BY_ID } from "./sections";
import { StatisticsSection } from "./statistics-section";

interface FsrsSectionProps {
	fsrs: FsrsState;
	histogramsError?: boolean;
	onRetryHistograms?: () => void;
}

const SECTION = STATISTICS_SECTIONS_BY_ID.fsrs;

/**
 * FSRS section. Four visualizations, each with a one-sentence plain-
 * English caption (per IA's `plain-language descriptions` requirement):
 *
 *   1. Desired-retention dial (target vs actual)
 *   2. Retention comparison (paired bars + delta)
 *   3. Stability distribution (how durable cards are)
 *   4. Difficulty distribution (how hard cards feel)
 */
export function FsrsSection({
	fsrs,
	histogramsError = false,
	onRetryHistograms,
}: FsrsSectionProps): React.JSX.Element {
	const retry = onRetryHistograms ?? (() => {});
	return (
		<StatisticsSection section={SECTION}>
			<div className="flex flex-col gap-y-6 lg:gap-y-6">
				{/* Top: Dial + comparison side by side on lg+ */}
				<SectionCard
					kanji="標"
					label="Retention target"
					description="Your target retention next to your real recall. The dial reads the rates; the gap shows how far above or below target you land."
				>
					<div className="grid grid-cols-1 items-center gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
						<DesiredRetentionDial
							desired={fsrs.desiredRetention}
							actual={fsrs.trueRetention}
						/>
						<RetentionComparison
							desired={fsrs.desiredRetention}
							actual={fsrs.trueRetention}
						/>
					</div>
				</SectionCard>

				<SectionCard
					kanji="強"
					label="Stability distribution"
					description="How durably your cards stick. Longer-stability cards need fewer reviews to keep retained."
				>
					{histogramsError
						? <ModuleError label="the stability distribution" onRetry={retry} />
						: (
								<FsrsHistogram
									buckets={fsrs.stability}
									ariaLabel={`Stability distribution across ${fsrs.stability.length} buckets.`}
								/>
							)}
				</SectionCard>

				<SectionCard
					kanji="難"
					label="Difficulty distribution"
					description="How hard your cards feel to recall. Higher difficulty means FSRS expects more lapses."
				>
					{histogramsError
						? <ModuleError label="the difficulty distribution" onRetry={retry} />
						: (
								<FsrsHistogram
									buckets={fsrs.difficulty}
									ariaLabel={`Difficulty distribution across ${fsrs.difficulty.length} buckets.`}
								/>
							)}
				</SectionCard>

				<p className="max-w-measure text-base leading-relaxed text-faded-sumi">
					<span className="font-medium text-sumi-ink">What to do with this:</span>
					{" "}
					if your actual retention runs below target, low-stability cards are where the
					reps matter most. If it runs above, a lower target would trim your daily load
					without much risk.
				</p>
			</div>
		</StatisticsSection>
	);
}
