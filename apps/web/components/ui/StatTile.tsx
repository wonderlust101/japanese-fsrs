import type { ReactNode } from 'react'

interface StatTileProps {
  /** Small-caps mono label above the value. */
  label: string
  /** The figure. A formatted string (count, percentage, span) rendered in the
   *  display face at tabular-nums so columns of figures align. */
  value: string
  /** Optional quiet sub-line beneath the value (e.g. "target 90%"). */
  hint?: ReactNode
  /** Optional inline node after the value (e.g. "· 24 cards"). */
  trailing?: ReactNode
  /** Render the value in vermillion-deep instead of sumi. Use sparingly. */
  accent?: boolean
}

/**
 * Design-system stat tile: a mono small-caps label over a tabular display
 * figure, with optional hint and trailing slots. One fixed size (26px value,
 * 11px label) so every grid of figures reads as one family rather than
 * near-identical hand-rolled tiles at drifting scales. Currently the Insights
 * surfaces (Progress summary, Statistics activity strip, Forecast time
 * estimate); available to any future metric grid with the same intent.
 *
 * Deliberately *not* the right primitive for zoned, kanji-eyebrowed ledgers
 * (e.g. the deck snapshot ribbon), which chunk figures into named actionable
 * zones and own their own type idiom on purpose.
 *
 * Renders a `<dt>`/`<dd>` pair, so it must live inside a `<dl>`.
 */
export function StatTile({
  label,
  value,
  hint,
  trailing,
  accent = false,
}: StatTileProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-y-2">
      <dt className="font-mono text-sm text-faded-sumi">{label}</dt>
      <dd className="flex items-baseline gap-x-2">
        <span
          className={[
            'font-display text-stat font-medium tabular-nums',
            accent ? 'text-inari-vermillion-deep' : 'text-sumi-ink',
          ].join(' ')}
        >
          {value}
        </span>
        {trailing !== undefined && (
          <span className="text-base text-faded-sumi">{trailing}</span>
        )}
      </dd>
      {hint !== undefined && (
        <span className="font-mono text-sm tabular-nums text-faded-sumi">
          {hint}
        </span>
      )}
    </div>
  )
}
