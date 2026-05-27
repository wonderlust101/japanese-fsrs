"use client";

type LevelKey = "beginner" | "N5" | "N4" | "N3" | "N2" | "N1";

interface VolumeBarProps {
	/** Current selection. `null` shows all levels at base opacity. */
	selected: LevelKey | null;
	className?: string;
}

interface LevelMark {
	key: LevelKey;
	label: string;
	cards: number;
	yPercent: number; // From bottom (0 = bottom of bar, 1 = top)
}

// Card-volume estimates aligned with onboarding/decks recommendations.
const LEVELS: ReadonlyArray<LevelMark> = [
	{ key: "beginner", label: "Beginner", cards: 200, yPercent: 0.03 },
	{ key: "N5", label: "N5", cards: 800, yPercent: 0.13 },
	{ key: "N4", label: "N4", cards: 1600, yPercent: 0.27 },
	{ key: "N3", label: "N3", cards: 3000, yPercent: 0.50 },
	{ key: "N2", label: "N2", cards: 4500, yPercent: 0.75 },
	{ key: "N1", label: "N1", cards: 6000, yPercent: 1.00 },
];

/**
 * Vertical bar visualization showing estimated card volume by JLPT level.
 * The bar fills upward to the selected level's height. Uppercase mono label
 * shows the cards count for the selected level.
 */
export function VolumeBar({ selected, className = "" }: VolumeBarProps): React.JSX.Element {
	const selectedLevel = selected !== null ? LEVELS.find(l => l.key === selected) : null;
	const fillHeight = selectedLevel?.yPercent ?? 0;

	return (
		<div className={["flex flex-col gap-3", className].join(" ")}>
			<div className="flex items-baseline justify-between text-sm font-mono text-faded-sumi">
				<span>Estimated cards to learn</span>
				<span className="text-faded-sumi">total</span>
			</div>

			<div className="flex items-stretch gap-4">
				{/* The vertical bar.
            Uses transform: scaleY (composited on the GPU) instead of animating
            height (which would trigger layout every frame). Anchor at bottom so
            the bar grows upward. */}
				<div className="relative w-12 h-[280px] bg-cream-inset rounded-xs overflow-hidden border border-soft-hairline">
					<div
						className="absolute inset-0 bg-inari-vermillion origin-bottom"
						style={{ transform: `scaleY(${fillHeight})` }}
					/>
				</div>

				{/* Labels alongside the bar, positioned to match each level's tick.
            justify-between lets variable-length labels (e.g. "Beginner") share
            the row with right-aligned counts without overlapping. */}
				<div className="relative flex-1 h-[280px]">
					{LEVELS.map((level) => {
						const isCurrent = selected === level.key;
						const topPct = (1 - level.yPercent) * 100;
						return (
							<div
								key={level.key}
								className="absolute left-0 right-0 flex items-center justify-between gap-3"
								style={{ top: `${topPct}%`, transform: "translateY(-50%)" }}
							>
								<span
									className={[
										"text-xs font-mono whitespace-nowrap",
										isCurrent ? "text-inari-vermillion font-semibold" : "text-faded-sumi",
									].join(" ")}
								>
									{level.label}
								</span>
								<span className="flex-1 h-px bg-soft-hairline/60" aria-hidden="true" />
								<span
									className={[
										"text-xs font-mono tabular-nums whitespace-nowrap",
										isCurrent ? "text-sumi-ink font-medium" : "text-faded-sumi",
									].join(" ")}
								>
									{level.cards.toLocaleString()}
								</span>
							</div>
						);
					})}
				</div>
			</div>

			<p className="text-xs text-faded-sumi leading-relaxed">
				Counts are vocabulary items typically learned to reach each JLPT level.
			</p>
		</div>
	);
}
