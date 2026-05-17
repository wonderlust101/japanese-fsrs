'use client'

import type { ApiDeckWithStats } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'

interface Props {
  deck:    ApiDeckWithStats | null | undefined
  loading: boolean
}

/**
 * Compact stats column for the Deck Detail sidebar. A single SectionCard with
 * rows of label + value, the brand vermillion stripe up top tying it to the
 * other module surfaces in the app. No charts — the brief flagged the
 * sparkline as a follow-up while the per-deck forecast endpoint lands.
 */
export function DeckStatsAside({ deck, loading }: Props): React.JSX.Element {
  const matureSuffix = deck != null && deck.cardCount > 0
    ? ` (${Math.round((deck.matureCount / deck.cardCount) * 100)}%)`
    : null

  return (
    <SectionCard kanji="数" label="Snapshot">
      <dl className="grid grid-cols-1 gap-y-3">
        <StatRow label="Due"        value={deck?.dueCount}        loading={loading} emphasize={(deck?.dueCount ?? 0) > 0} />
        <StatRow label="New due"    value={deck?.dueNewCount}     loading={loading} />
        <StatRow label="Review due" value={deck?.dueReviewCount}  loading={loading} />
        <Separator />
        <StatRow label="Total cards" value={deck?.cardCount}      loading={loading} />
        <StatRow label="New"         value={deck?.newCount}       loading={loading} />
        <StatRow
          label="Mature"
          value={deck?.matureCount}
          loading={loading}
          {...(matureSuffix !== null && { suffix: matureSuffix })}
        />
        <Separator />
        <MetaRow label="Last update" value={deck?.updatedAt ? formatRelativeDay(deck.updatedAt) : null} loading={loading} />
        <MetaRow label="Created"     value={deck?.createdAt ? formatMonthYear(deck.createdAt) : null} loading={loading} />
      </dl>
    </SectionCard>
  )
}

function StatRow({
  label,
  value,
  loading,
  emphasize,
  suffix,
}: {
  label:      string
  value:      number | undefined
  loading:    boolean
  emphasize?: boolean
  suffix?:    string
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi">
        {label}
      </dt>
      <dd
        className={[
          'font-mono text-base tabular-nums leading-none',
          emphasize === true ? 'font-semibold text-inari-vermillion-deep' : 'text-sumi-ink',
        ].join(' ')}
      >
        {loading ? (
          <span aria-hidden="true" className="inline-block h-4 w-10 animate-pulse rounded-[1px] bg-cream-inset" />
        ) : (
          <>
            <span>{value ?? 0}</span>
            {suffix !== undefined && <span className="ml-1 text-faded-sumi text-xs">{suffix}</span>}
          </>
        )}
      </dd>
    </div>
  )
}

function MetaRow({
  label,
  value,
  loading,
}: {
  label:   string
  value:   string | null
  loading: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi">
        {label}
      </dt>
      <dd className="text-sm text-sumi-ink/85">
        {loading ? (
          <span aria-hidden="true" className="inline-block h-4 w-20 animate-pulse rounded-[1px] bg-cream-inset" />
        ) : (
          value ?? '—'
        )}
      </dd>
    </div>
  )
}

function Separator(): React.JSX.Element {
  return <div aria-hidden="true" className="my-0.5 h-px w-full bg-soft-hairline" />
}

function formatRelativeDay(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const diffMs = today.getTime() - date.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} wk ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
