import { Button } from '@/components/ui/button'

interface Sentence { ja: string; en: string; furigana: string }

interface Props { sentences: Sentence[] }

export function ExampleSentences({ sentences }: Props) {
  return (
    <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-4">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Example Sentences</h2>
      <ul className="space-y-4">
        {sentences.map((s, i) => (
          <li key={i} className="space-y-0.5">
            <p lang="ja" className="text-base leading-[1.9]">{s.ja}</p>
            {s.furigana.length > 0 && (
              <p lang="ja" className="text-sm text-neutral-500 leading-[1.9]">{s.furigana}</p>
            )}
            <p className="text-sm text-neutral-500">{s.en}</p>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" disabled>Regenerate →</Button>
    </section>
  )
}
