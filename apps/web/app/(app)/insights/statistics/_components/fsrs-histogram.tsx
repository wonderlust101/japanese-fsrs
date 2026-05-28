import type { FsrsHistogramBucket } from "./types";

interface FsrsHistogramProps {
	buckets: ReadonlyArray<FsrsHistogramBucket>;
	ariaLabel: string;
}

/**
 * Horizontal histogram for FSRS distributions (stability, difficulty).
 * Each bucket renders as a row: label on the left, bar in the middle,
 * count on the right. Single-hue vermillion-deep ramp by rank so the
 * larger buckets read darkest.
 */
export function FsrsHistogram({ buckets, ariaLabel }: FsrsHistogramProps): React.JSX.Element {
	if (buckets.length === 0) {
		return (
			<p className="text-sm leading-[1.55] text-faded-sumi">
				No FSRS distribution data yet. Run a couple weeks of reviews to populate this view.
			</p>
		);
	}

	const max = Math.max(...buckets.map(b => b.count));
	const safe = Math.max(1, max);
	const total = buckets.reduce((acc, b) => acc + b.count, 0);

	// Rank buckets by count (descending) for opacity stepping while preserving
	// display order (we want the buckets in their natural label order).
	const rankByCount = new Map<string, number>()
  ;[...buckets]
		.sort((a, b) => b.count - a.count)
		.forEach((b, i) => rankByCount.set(b.label, i));

	return (
		<figure
			role="img"
			aria-label={ariaLabel}
			className="flex flex-col gap-y-3"
		>
			{buckets.map((bucket) => {
				const widthPct = (bucket.count / safe) * 100;
				const rank = rankByCount.get(bucket.label) ?? 0;
				const opacity = Math.max(0.35, 1 - rank * 0.12);
				const share = total > 0 ? Math.round((bucket.count / total) * 100) : 0;
				return (
					<div key={bucket.label} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-x-4">
						<span className="font-mono text-sm text-sumi-ink/85">
							{bucket.label}
						</span>
						<div className="relative h-[10px] w-full overflow-hidden rounded-xs bg-soft-hairline/40">
							<span
								aria-hidden="true"
								className="absolute left-0 top-0 block h-full"
								style={{
									width: `${widthPct}%`,
									backgroundColor: "var(--color-inari-vermillion-deep)",
									opacity,
								}}
							/>
						</div>
						<span className="text-right font-mono text-sm tabular-nums text-sumi-ink/85">
							{bucket.count}
							<span className="ml-1.5 text-sm text-faded-sumi">
								·
								{" "}
								{share}
								%
							</span>
						</span>
					</div>
				);
			})}
		</figure>
	);
}
