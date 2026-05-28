import type { ProgressData } from "./progress-types";
import { StatTile } from "@/components/ui/StatTile";
import { buildSummaryLine } from "./progress-interpretation";

interface ProgressSummaryStripProps {
	data: ProgressData;
}

interface Tile {
	label: string;
	value: string;
	hint?: string;
}

function fmt(n: number): string {
	return n.toLocaleString("en-US");
}

function pct(n: number): string {
	return `${Math.round(n * 100)}%`;
}

/**
 * Summary SectionCard body. Four stat tiles followed by a two-line
 * plain-language read. Tiles use a flat type pair (mono small-caps label
 * over tabular display value) with no icons, no deltas, no hero numbers.
 * Deltas live in the prose underneath; this strip is the snapshot.
 */
export function ProgressSummaryStrip({ data }: ProgressSummaryStripProps): React.JSX.Element {
	const { summary } = data;
	const tiles: Tile[] = [
		{
			label: "Mature cards",
			value: fmt(summary.matureCount),
			hint: "in long-term storage",
		},
		{
			label: "Retention, 30d",
			value: pct(summary.retention30d),
			hint: `target ${pct(data.desiredRetention)}`,
		},
		{
			label: "Active days",
			value: `${summary.activeDaysLast30} / 30`,
			hint: "of the past 30 days",
		},
		{
			label: "Added this month",
			value: `+${fmt(summary.cardsAddedThisMonth)}`,
			hint: "new cards",
		},
	];

	return (
		<div className="flex flex-col gap-y-6">
			<dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 sm:gap-x-8">
				{tiles.map(t => (
					<StatTile
						key={t.label}
						label={t.label}
						value={t.value}
						{...(t.hint !== undefined && { hint: t.hint })}
					/>
				))}
			</dl>

			<p className="max-w-measure text-sm leading-[1.55] text-faded-sumi">
				{buildSummaryLine(data)}
			</p>
		</div>
	);
}
