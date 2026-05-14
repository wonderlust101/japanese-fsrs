'use client'

import type { ProfileStubData } from './profile-stub-data'
import { formatJlptLevel, formatJoinedMonth } from './profile-shared'

export type BasicInfoVariant = 'chips' | 'dl' | 'inline' | 'tiles'

export const BASICINFO_VARIANTS: readonly BasicInfoVariant[] = [
  'chips', 'dl', 'inline', 'tiles',
]

export const BASICINFO_META: Record<BasicInfoVariant, { short: string; label: string; blurb: string }> = {
  chips:  { short: 'B1', label: 'Chips',     blurb: 'Horizontal row of small label·value pills.' },
  dl:     { short: 'B2', label: 'Def list',  blurb: 'Two-column definition list. Most catalog-y.' },
  inline: { short: 'B3', label: 'Inline',    blurb: 'Single dot-separated sentence. Most Are.na.' },
  tiles:  { short: 'B4', label: 'Tiles',     blurb: 'Small 4-up grid of value + tiny label.' },
}

interface BasicInfoProps {
  variant:    BasicInfoVariant
  jlptTarget: string | null
  joinedAt:   string
  stub:       Pick<ProfileStubData, 'location' | 'nativeLanguage' | 'studyPurpose'>
}

export function BasicInfoSection(props: BasicInfoProps): React.JSX.Element {
  switch (props.variant) {
    case 'chips':  return <BasicInfoChips  {...props} />
    case 'dl':     return <BasicInfoDl     {...props} />
    case 'inline': return <BasicInfoInline {...props} />
    case 'tiles':  return <BasicInfoTiles  {...props} />
  }
}

function joinedYear(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return String(d.getFullYear())
}

/** B1 — Chips. A horizontal flex row of small label·value pills.
 *  Compact and tag-like; the study purpose is excluded because it'd
 *  break the chip rhythm. */
function BasicInfoChips({ jlptTarget, joinedAt, stub }: BasicInfoProps): React.JSX.Element {
  const facts: { label: string; value: string }[] = [
    { label: 'Native',  value: stub.nativeLanguage },
    { label: 'Target',  value: formatJlptLevel(jlptTarget) },
    { label: 'Since',   value: joinedYear(joinedAt) },
    { label: 'From',    value: stub.location },
  ]
  return (
    <ul className="flex flex-wrap gap-2">
      {facts.map((f) => (
        <li
          key={f.label}
          className="inline-flex items-baseline gap-1.5 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-2.5 py-1"
        >
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
            {f.label}
          </span>
          <span className="text-sm text-sumi-ink">{f.value}</span>
        </li>
      ))}
    </ul>
  )
}

/** B2 — Definition list. Two-column dl with mono labels and DM Sans
 *  values. The study purpose lives on its own row underneath, allowed
 *  to wrap. Most catalog-leaning. */
function BasicInfoDl({ jlptTarget, joinedAt, stub }: BasicInfoProps): React.JSX.Element {
  return (
    <dl className="grid max-w-[34rem] grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-6 gap-y-2 text-sm">
      <Row term="Native"        value={stub.nativeLanguage} />
      <Row term="Target"        value={formatJlptLevel(jlptTarget)} />
      <Row term="Joined"        value={formatJoinedMonth(joinedAt)} />
      <Row term="Location"      value={stub.location} />
      <Row term="Studying for"  value={stub.studyPurpose} />
    </dl>
  )
}

function Row({ term, value }: { term: string; value: string }): React.JSX.Element {
  return (
    <>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">{term}</dt>
      <dd className="text-sumi-ink">{value}</dd>
    </>
  )
}

/** B3 — Inline. A single dot-separated line that wraps. Closest to the
 *  Are.na anchor; the line is the whole section. */
function BasicInfoInline({ jlptTarget, joinedAt, stub }: BasicInfoProps): React.JSX.Element {
  return (
    <p className="max-w-[62ch] text-base leading-relaxed text-sumi-ink">
      <span>{stub.nativeLanguage} speaker</span>
      <span className="mx-2 text-faded-sumi/55">·</span>
      <span>targeting {formatJlptLevel(jlptTarget)}</span>
      <span className="mx-2 text-faded-sumi/55">·</span>
      <span>since {formatJoinedMonth(joinedAt)}</span>
      <span className="mx-2 text-faded-sumi/55">·</span>
      <span>based in {stub.location}</span>
      <span className="mx-2 text-faded-sumi/55">·</span>
      <span className="text-faded-sumi">{stub.studyPurpose.toLowerCase()}.</span>
    </p>
  )
}

/** B4 — Stat tiles. A 4-up grid of small value/label tiles. Most
 *  graphic; reads like dashboard chips. Study purpose is intentionally
 *  not rendered here because it doesn't fit the fixed-tile rhythm. */
function BasicInfoTiles({ jlptTarget, joinedAt, stub }: BasicInfoProps): React.JSX.Element {
  const tiles: { value: string; label: string }[] = [
    { value: stub.nativeLanguage,           label: 'Native'   },
    { value: formatJlptLevel(jlptTarget),   label: 'Target'   },
    { value: joinedYear(joinedAt),          label: 'Since'    },
    { value: stub.location,                 label: 'From'     },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3.5 py-3"
        >
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
            {t.label}
          </p>
          <p className="mt-1.5 text-base font-medium leading-tight text-sumi-ink">{t.value}</p>
        </div>
      ))}
    </div>
  )
}
