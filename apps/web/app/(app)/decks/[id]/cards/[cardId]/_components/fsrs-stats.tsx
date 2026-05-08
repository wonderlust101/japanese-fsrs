import { State, type ApiCard } from '@fsrs-japanese/shared-types'

interface Props { card: ApiCard }

function formatStability(days: number): string {
  return days < 1 ? '< 1d' : `~${days.toFixed(1)}d`
}

export function FsrsStats({ card }: Props): React.JSX.Element {
  const dueDate = new Date(card.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-3">
      <h2 className="text-xs font-semibold text-faded-sumi uppercase tracking-wider">Review History</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-faded-sumi">
        <span>Stability: <span className="font-medium text-sumi-ink">{formatStability(card.stability)}</span></span>
        <span aria-hidden="true" className="text-faded-sumi">·</span>
        <span>Difficulty: <span className="font-medium text-sumi-ink">{card.difficulty.toFixed(1)}</span></span>
        <span aria-hidden="true" className="text-faded-sumi">·</span>
        <span>Next review: <span className="font-medium text-sumi-ink">{dueDate}</span></span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-faded-sumi">
        <span>Reviews: <span className="font-medium text-sumi-ink">{card.reps}</span></span>
        <span aria-hidden="true" className="text-faded-sumi">·</span>
        <span>Lapses: <span className="font-medium text-sumi-ink">{card.lapses}</span></span>
        <span aria-hidden="true" className="text-faded-sumi">·</span>
        <span>State: <span className="font-medium text-sumi-ink">{State[card.state]}</span></span>
        {card.isSuspended && (
          <span className="ml-1 rounded bg-cream-inset px-2 text-xs font-medium text-sumi-ink">
            Suspended
          </span>
        )}
      </div>
    </section>
  )
}
