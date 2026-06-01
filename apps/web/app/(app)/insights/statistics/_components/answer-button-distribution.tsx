import type { AnswerButtonDistribution as Distribution } from "./types";

import { cn } from "@/lib/utils";

interface AnswerButtonDistributionProps {
	data: Distribution;
}

interface Slice {
	key: "again" | "hard" | "good" | "easy";
	label: string;
	count: number;
	/** Tailwind bg class — same class the review session rating button uses. */
	bg: string;
}

/**
 * Horizontal stacked-bar distribution of the four rating buttons. Each
 * segment uses the dedicated `--color-rating-*` token the actual Review
 * Session rating bar (`components/review/RatingBar.tsx`) renders: deep
 * vermillion (Again), warm terracotta (Hard), mossy sage (Good), and
 * aizome blue (Easy). These tokens are defined in globals.css's `@theme`
 * block, distinct from sumi/JLPT/aizome neutral tokens, so the chart
 * stays visually faithful to the rating UI even if those other palettes
 * shift.
 */
export function AnswerButtonDistribution({
	data,
}: AnswerButtonDistributionProps): React.JSX.Element {
	const slices: Slice[] = [
		{ key: "again", label: "Again", count: data.again, bg: "bg-rating-again" },
		{ key: "hard", label: "Hard", count: data.hard, bg: "bg-rating-hard" },
		{ key: "good", label: "Good", count: data.good, bg: "bg-rating-good" },
		{ key: "easy", label: "Easy", count: data.easy, bg: "bg-rating-easy" },
	];

	const total = slices.reduce((acc, s) => acc + s.count, 0);

	if (total === 0) {
		return (
			<p className="text-sm leading-[1.55] text-faded-sumi">
				No answer data yet. Rate cards during reviews to see how often you reach for each button.
			</p>
		);
	}

	const safeTotal = total;

	return (
		<figure className="flex flex-col gap-y-4">
			<div
				role="img"
				aria-label={
					`Answer button distribution across ${total} reviews. ${
						slices.map(s => `${s.label} ${Math.round((s.count / safeTotal) * 100)}%`).join(", ")
					}.`
				}
				className="flex h-11 w-full overflow-hidden rounded-xs border border-soft-hairline"
			>
				{slices.map((s) => {
					const widthPct = (s.count / safeTotal) * 100;
					if (widthPct <= 0)
						return null;
					return (
						<span
							key={s.key}
							aria-hidden="true"
							title={`${s.label}: ${s.count} (${Math.round(widthPct)}%)`}
							className={cn(
								"block h-full border-r border-warm-paper-raised/80 last:border-r-0",
								s.bg,
							)}
							style={{ width: `${widthPct}%` }}
						/>
					);
				})}
			</div>

			<ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
				{slices.map((s) => {
					const pct = Math.round((s.count / safeTotal) * 100);
					return (
						<li key={s.key} className="flex items-baseline gap-x-3">
							<span
								aria-hidden="true"
								className={cn(
									"mt-1 inline-block h-[10px] w-[10px] shrink-0 rounded-xs",
									s.bg,
								)}
							/>
							<span className="font-mono text-sm text-sumi-ink/85">
								{s.label}
							</span>
							<span className="ml-auto font-mono text-sm tabular-nums text-sumi-ink">
								{pct}
								%
								<span className="ml-1.5 text-sm text-faded-sumi">
									·
									{" "}
									{s.count}
								</span>
							</span>
						</li>
					);
				})}
			</ul>
		</figure>
	);
}
