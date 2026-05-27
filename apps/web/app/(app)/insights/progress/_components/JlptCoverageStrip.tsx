import type { JlptCoverage, ProgressData } from "./progressTypes";
import { buildJlptLine } from "./progressInterpretation";

interface JlptCoverageStripProps {
	data: ProgressData;
}

/**
 * Demoted JLPT view. One segmented horizontal bar across the card width.
 * Segments are sized in proportion to the total cards in each level (from
 * JLPT_TOTALS; N1 is by far the largest), which visually communicates the
 * asymmetric scale of the levels themselves. Within each segment, each
 * level paints with its own JLPT identity color (green / emerald / blue
 * / violet / red) — the same palette used by the JlptPill component —
 * with the encountered tint as the soft base and the owned fill in the
 * saturated mark color on top.
 *
 * Above the bar: a quiet interpretation line. Below: a per-level
 * legend with the colored level pill, owned/total count, and percent.
 * The bar itself is intentionally label-free so it reads as pure
 * data — identity from color, scale from width, coverage from fill.
 */

interface LevelStyle {
	/** Background wash used for the segment's "encountered" layer. */
	washVar: string;
	/** Saturated mark used for the "owned" foreground layer and the level chip. */
	markVar: string;
	/** Text color for the segment label so it remains legible on top of the fills. */
	textVar: string;
}

const LEVEL_STYLES: Record<JlptCoverage["level"], LevelStyle> = {
	N5: { washVar: "var(--color-jlpt-n5-bg)", markVar: "var(--color-jlpt-n5-text)", textVar: "var(--color-jlpt-n5-text)" },
	N4: { washVar: "var(--color-jlpt-n4-bg)", markVar: "var(--color-jlpt-n4-text)", textVar: "var(--color-jlpt-n4-text)" },
	N3: { washVar: "var(--color-jlpt-n3-bg)", markVar: "var(--color-jlpt-n3-text)", textVar: "var(--color-jlpt-n3-text)" },
	N2: { washVar: "var(--color-jlpt-n2-bg)", markVar: "var(--color-jlpt-n2-text)", textVar: "var(--color-jlpt-n2-text)" },
	N1: { washVar: "var(--color-jlpt-n1-bg)", markVar: "var(--color-jlpt-n1-text)", textVar: "var(--color-jlpt-n1-text)" },
};

export function JlptCoverageStrip({ data }: JlptCoverageStripProps): React.JSX.Element {
	const jlpt = data.jlpt;
	const totalAll = jlpt.reduce((acc, j) => acc + j.total, 0);

	return (
		<div className="flex flex-col gap-y-6">
			<p className="max-w-measure text-sm leading-[1.55] text-faded-sumi">
				{buildJlptLine(data)}
			</p>

			<div
				role="img"
				aria-label="JLPT coverage by level. Each segment is sized by total cards in that level; fill shows owned cards."
				className="flex h-11 w-full overflow-hidden rounded-xs border border-soft-hairline bg-cream-inset/60"
			>
				{jlpt.map((level) => {
					const widthPct = totalAll > 0 ? (level.total / totalAll) * 100 : 0;
					return (
						<JlptSegment key={level.level} level={level} widthPct={widthPct} />
					);
				})}
			</div>

			<ul className="flex flex-col gap-y-3">
				{jlpt.map((level) => {
					const pct = level.total > 0 ? Math.round((level.owned / level.total) * 100) : 0;
					const styles = LEVEL_STYLES[level.level];
					return (
						<li key={level.level} className="flex items-center justify-between gap-x-3">
							<span
								className="inline-flex w-fit shrink-0 items-center rounded-xs px-2 py-0.5 font-mono text-sm"
								style={{ backgroundColor: styles.washVar, color: styles.textVar }}
							>
								{level.level}
							</span>
							<span className="flex items-baseline gap-x-2 font-mono text-sm tabular-nums">
								<span className="text-sumi-ink">{level.owned.toLocaleString("en-US")}</span>
								<span className="text-faded-sumi">
									/
									{level.total.toLocaleString("en-US")}
								</span>
								<span className="text-faded-sumi">
									(
									{pct}
									%)
								</span>
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

interface JlptSegmentProps {
	level: JlptCoverage;
	widthPct: number;
}

function JlptSegment({ level, widthPct }: JlptSegmentProps): React.JSX.Element {
	const ownedPct = level.total > 0 ? (level.owned / level.total) * 100 : 0;
	const encounteredPct = level.total > 0 ? (level.encountered / level.total) * 100 : 0;
	const styles = LEVEL_STYLES[level.level];
	return (
		<div
			title={`${level.level}: ${level.owned} of ${level.total} cards owned, ${level.encountered} encountered`}
			className="relative h-full border-r border-warm-paper-raised/85 last:border-r-0"
			style={{ width: `${widthPct}%` }}
		>
			{/* Encountered (level wash, soft) */}
			<span
				aria-hidden="true"
				className="absolute inset-y-0 left-0"
				style={{ width: `${encounteredPct}%`, backgroundColor: styles.washVar }}
			/>
			{/* Owned (level mark, saturated) */}
			<span
				aria-hidden="true"
				className="absolute inset-y-0 left-0"
				style={{ width: `${ownedPct}%`, backgroundColor: styles.markVar, opacity: 0.85 }}
			/>
		</div>
	);
}
