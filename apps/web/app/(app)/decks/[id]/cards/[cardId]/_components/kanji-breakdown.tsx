interface KanjiPair { kanji: string; meaning: string }

interface Props { breakdown: KanjiPair[] }

export function KanjiBreakdown({ breakdown }: Props): React.JSX.Element {
  return (
    <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Kanji Breakdown</h2>
      <div className="flex flex-wrap gap-3">
        {breakdown.map(({ kanji, meaning }) => (
          <div
            key={kanji}
            className="flex flex-col items-center p-2.5 bg-neutral-50 rounded-[var(--radius-md)] min-w-[3.5rem]"
          >
            <span lang="ja" className="text-xl font-bold text-neutral-900">{kanji}</span>
            <span className="text-xs text-neutral-500 mt-0.5 text-center">{meaning}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
