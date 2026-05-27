import { SectionCard } from "@/components/ui/SectionCard";

interface KanjiBreakdownEntry {
	kanji: string;
	radical: string;
	meaning?: string;
	reading?: string;
}

interface Props { breakdown: KanjiBreakdownEntry[] }

/**
 * Per-kanji card: large character on top, radical line, then meaning + reading
 * stacked underneath. Renders all four fields the schema supplies (the prior
 * version showed only kanji + meaning). On a wide column the entries flow as
 * a horizontal row; on narrow widths they wrap.
 */
export function KanjiBreakdown({ breakdown }: Props): React.JSX.Element {
	return (
		<SectionCard kanji="字" label="Kanji breakdown">
			<div className="flex flex-wrap gap-3">
				{breakdown.map(entry => (
					<div
						key={entry.kanji}
						className="flex min-w-[8rem] flex-1 flex-col gap-1 rounded-xs border border-soft-hairline bg-cream-inset/35 p-3 sm:flex-[0_0_auto] sm:min-w-[10rem]"
					>
						<div className="flex items-baseline gap-2">
							<span lang="ja" className="text-2xl font-semibold leading-none text-sumi-ink">
								{entry.kanji}
							</span>
							{entry.reading !== undefined && entry.reading.length > 0 && (
								<span lang="ja" className="font-mono text-xs text-faded-sumi">
									{entry.reading}
								</span>
							)}
						</div>
						<p className="font-mono text-sm text-faded-sumi">
							<span className="text-sumi-ink/70">{entry.radical}</span>
						</p>
						{entry.meaning !== undefined && entry.meaning.length > 0 && (
							<p className="text-sm leading-snug text-sumi-ink/85">{entry.meaning}</p>
						)}
					</div>
				))}
			</div>
		</SectionCard>
	);
}
