interface KanjiPair { kanji: string; meaning: string }

interface Props { breakdown: KanjiPair[] }

export function KanjiBreakdown({ breakdown }: Props): React.JSX.Element {
  return (
    <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3">
      <h2 className="text-xs font-semibold text-faded-sumi uppercase tracking-wider">Kanji Breakdown</h2>
      <div className="flex flex-wrap gap-3">
        {breakdown.map(({ kanji, meaning }) => (
          <div
            key={kanji}
            className="flex flex-col items-center p-2.5 bg-cream-inset rounded-[var(--radius-md)] min-w-[3.5rem]"
          >
            <span lang="ja" className="text-xl font-bold text-sumi-ink">{kanji}</span>
            <span className="text-xs text-faded-sumi mt-0.5 text-center">{meaning}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
