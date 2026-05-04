import type { CardDetail } from '@/lib/actions/cards.actions'

interface Props { card: CardDetail }

function formatStability(days: number): string {
  return days < 1 ? '< 1d' : `~${days.toFixed(1)}d`
}

export function FsrsStats({ card }: Props): React.JSX.Element {
  const dueDate = new Date(card.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Review History</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600">
        <span>Stability: <span className="font-medium text-neutral-900">{formatStability(card.stability)}</span></span>
        <span aria-hidden="true" className="text-neutral-300">·</span>
        <span>Difficulty: <span className="font-medium text-neutral-900">{card.difficulty.toFixed(1)}</span></span>
        <span aria-hidden="true" className="text-neutral-300">·</span>
        <span>Next review: <span className="font-medium text-neutral-900">{dueDate}</span></span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600">
        <span>Reviews: <span className="font-medium text-neutral-900">{card.reps}</span></span>
        <span aria-hidden="true" className="text-neutral-300">·</span>
        <span>Lapses: <span className="font-medium text-neutral-900">{card.lapses}</span></span>
        <span aria-hidden="true" className="text-neutral-300">·</span>
        <span>Status: <span className="font-medium text-neutral-900 capitalize">{card.status}</span></span>
      </div>
    </section>
  )
}
