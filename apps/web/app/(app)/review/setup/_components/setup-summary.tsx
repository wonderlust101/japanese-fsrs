"use client";

import type { QueueBreakdown } from "@/lib/review/queue-classify";
import { CompositionStrip } from "@/components/review/CompositionStrip";
import { SectionCard } from "@/components/ui/SectionCard";

import { totalFromBreakdown } from "@/lib/review/queue-classify";
import { cn } from "@/lib/utils";

export type SummaryTone = "default" | "empty" | "loading";

interface SetupSummaryProps {
	tone: SummaryTone;
	breakdown: QueueBreakdown;
	timeLabel: string;
	/** Sticky action area: composed by the orchestrator (Start button, reset link). */
	actions: React.ReactNode;
	/**
	 * Quiet inline flag rendered after the section label (e.g. offline /
	 *  stale-data signal). Forwarded to SectionCard.
	 */
	flag?: string;
}

// The summary lives inside a SectionCard so it inherits the Today module
// chrome. CompositionStrip carries the chart; meta counts and the action
// area follow. The 'loading' tone is now a no-op — wait-then-reveal is
// handled at the route level by <PageLoader/>.

export function SetupSummary({
	tone,
	breakdown,
	timeLabel,
	actions,
	flag,
}: SetupSummaryProps): React.JSX.Element | null {
	if (tone === "loading")
		return null;

	const total = totalFromBreakdown(breakdown);

	const description = tone === "empty"
		? "Nothing scheduled today."
		: "Your queue for right now.";

	return (
		<SectionCard
			id="review-setup-summary"
			kanji="今"
			label="Today's session"
			description={description}
			stripeTone="brand"
			{...(flag !== undefined && { flag })}
		>
			<div className="flex flex-col gap-3">
				<p className="font-mono text-sm text-faded-sumi">
					Review breakdown
				</p>
				<CompositionStrip
					breakdown={breakdown}
					tone={tone === "empty" ? "muted" : "default"}
				/>
			</div>

			{/* Polite SR summary. One condensed line announces session state
          on tuning changes, mirroring the two visible stats. */}
			<p className="sr-only" aria-live="polite">
				{`${total} ${total === 1 ? "card" : "cards"}, ${
					total === 0 ? "no time" : timeLabel.replace("≈ ", "")
				}.`}
			</p>

			{/* Total + Time evenly spread across the card. Two-column grid
          with each stat centered inside its half, so the pair sits at
          ~25% / ~75% of the card width — symmetric breathing room on
          both edges and through the middle. Collapses to a single
          stacked column under sm for phone reading. */}
			<dl
				className={cn(
					"mt-6",
					"grid grid-cols-1 sm:grid-cols-2",
					"gap-x-6 gap-y-4",
				)}
			>
				<PrimaryStat
					label="Total"
					value={total === 0 ? "0" : String(total)}
					suffix={total === 1 ? "card" : "cards"}
				/>
				<PrimaryStat
					label="Time"
					value={total === 0 ? "0 min" : timeLabel.replace("≈ ", "")}
				/>
			</dl>

			{/* Internal actions appear from lg upward. The "Tuning just for this
          session" banner was removed: the action area's "Save as default"
          affordance + the per-row modified-dot indicators carry the same
          information without competing for space inside the summary card. */}
			<div className="mt-6 hidden lg:block">
				{actions}
			</div>
		</SectionCard>
	);
}

function PrimaryStat({
	label,
	value,
	suffix,
}: {
	label: string;
	value: string;
	suffix?: string;
}): React.JSX.Element {
	// Each stat anchors to the left edge of its grid cell. With the dl's
	// two equal columns, Total sits at 0% and Time at 50% of the card
	// width — left-aligned individually, evenly spread across the row.
	// On mobile the grid is single-column and the stat reads start-to-end
	// down the page.
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
