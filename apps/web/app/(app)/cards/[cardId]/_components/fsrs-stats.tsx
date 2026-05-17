import { State, type ApiCard } from '@fsrs-japanese/shared-types'

interface Props { card: ApiCard }

function formatStability(days: number): string {
  return days < 1 ? '< 1d' : `~${days.toFixed(1)}d`
}

function practiceStateLabel(state: State): string {
  switch (state) {
    case State.New:        return 'New'
    case State.Learning:   return 'Learning'
    case State.Relearning: return 'Relearning'
    case State.Review:     return 'Review'
    default: {
      const _exhaustiveCheck: never = state
      return _exhaustiveCheck
    }
  }
}

/**
 * Scheduling / FSRS detail rows. Designed to render inside a containing
 * SectionCard or `<details>` panel — emits a plain key/value list with no
 * surrounding chrome of its own.
 */
export function FsrsStats({ card }: Props): React.JSX.Element {
  const dueDate = new Date(card.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <dl className="grid grid-cols-1 gap-y-2.5">
      <Row label="State"        value={practiceStateLabel(card.state)} />
      <Row label="Next review"  value={dueDate} />
      <Row label="Stability"    value={formatStability(card.stability)} />
      <Row label="Difficulty"   value={card.difficulty.toFixed(1)} />
      <Row label="Reviews"      value={String(card.reps)} />
      <Row label="Lapses"       value={String(card.lapses)} emphasize={card.lapses >= 3} />
      {card.isSuspended && (
        <Row label="Status"     value="Suspended" emphasize />
      )}
    </dl>
  )
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi">{label}</dt>
      <dd
        className={[
          'font-mono text-sm tabular-nums leading-none',
          emphasize === true ? 'font-semibold text-inari-vermillion-deep' : 'text-sumi-ink',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}
