'use client'

import type { ProfileStubData } from './profile-stub-data'
import { formatJlptLevel, formatJoinedMonth } from './profile-shared'

export type MastheadVariant = 'quiet' | 'bricolage' | 'catalog' | 'stamped'

export const MASTHEAD_VARIANTS: readonly MastheadVariant[] = [
  'quiet', 'bricolage', 'catalog', 'stamped',
]

export const MASTHEAD_META: Record<MastheadVariant, { short: string; label: string; blurb: string }> = {
  quiet:     { short: 'M1', label: 'Quiet',     blurb: 'Are.na pure. DM Sans name, inline meta, prose bio.' },
  bricolage: { short: 'M2', label: 'Display',   blurb: 'Name in Bricolage display, oversized 友 watermark.' },
  catalog:   { short: 'M3', label: 'Catalog',   blurb: 'Library-card metadata grid. Mono labels.' },
  stamped:   { short: 'M4', label: 'Stamped',   blurb: 'Kitsune 友 at hero scale, identity to the right.' },
}

interface MastheadProps {
  variant:     MastheadVariant
  displayName: string
  jlptTarget:  string | null
  joinedAt:    string
  stub:        Pick<ProfileStubData, 'handle' | 'bio' | 'location'>
}

export function MastheadSection(props: MastheadProps): React.JSX.Element {
  switch (props.variant) {
    case 'quiet':     return <MastheadQuiet     {...props} />
    case 'bricolage': return <MastheadBricolage {...props} />
    case 'catalog':   return <MastheadCatalog   {...props} />
    case 'stamped':   return <MastheadStamped   {...props} />
  }
}

function EditLink(): React.JSX.Element {
  return (
    <button
      type="button"
      className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi hover:text-sumi-ink ui-motion-colors"
    >
      Edit
    </button>
  )
}

/** M1 — Quiet. Are.na profile pure. DM Sans throughout, no display face.
 *  Meta inline with mid-dot separators, bio as prose. 友 seal hint at top
 *  right, faintest vermillion hairline beneath. */
function MastheadQuiet({ displayName, jlptTarget, joinedAt, stub }: MastheadProps): React.JSX.Element {
  return (
    <section aria-label="Identity" className="relative">
      <span aria-hidden="true" className="absolute right-0 top-0 font-display text-2xl text-inari-vermillion/70" lang="ja">友</span>
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-sumi-ink">{displayName}</h2>
        <EditLink />
      </header>
      <p className="mt-1.5 text-sm text-faded-sumi">
        <span className="font-mono">{stub.handle}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span>{formatJlptLevel(jlptTarget)}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span>joined {formatJoinedMonth(joinedAt)}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span>{stub.location}</span>
      </p>
      <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-sumi-ink">{stub.bio}</p>
      <div aria-hidden="true" className="mt-8 h-px bg-inari-vermillion/55" />
    </section>
  )
}

/** M2 — Bricolage display. Name in display scale (font-display, 5xl tight).
 *  Oversized 友 sits to the right as a low-opacity sumi watermark.
 *  Vermillion hairline is dropped (the watermark carries identity instead). */
function MastheadBricolage({ displayName, jlptTarget, joinedAt, stub }: MastheadProps): React.JSX.Element {
  return (
    <section aria-label="Identity" className="relative overflow-hidden">
      <span
        aria-hidden="true"
        lang="ja"
        className="pointer-events-none absolute -right-2 -top-2 select-none font-display text-[7rem] leading-none text-inari-vermillion/15 sm:text-[8.5rem]"
      >
        友
      </span>
      <header className="relative flex items-start justify-between gap-4">
        <h2 className="font-display text-[2.75rem] font-medium leading-[0.95] tracking-tight text-sumi-ink sm:text-[3.25rem]">
          {displayName}
        </h2>
        <EditLink />
      </header>
      <p className="relative mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        {formatJlptLevel(jlptTarget)}
        <span className="mx-2 text-faded-sumi/45">·</span>
        since {formatJoinedMonth(joinedAt)}
        <span className="mx-2 text-faded-sumi/45">·</span>
        {stub.location}
      </p>
      <p className="relative mt-6 max-w-[56ch] text-base leading-relaxed text-sumi-ink">{stub.bio}</p>
      <div aria-hidden="true" className="mt-10 h-px bg-soft-hairline" />
    </section>
  )
}

/** M3 — Catalog. Library-card composition. Mono uppercase labels in a
 *  definition-list grid, body bio below a hairline rule. Sits inside a
 *  bordered plate with the 2px vermillion top stripe. */
function MastheadCatalog({ displayName, jlptTarget, joinedAt, stub }: MastheadProps): React.JSX.Element {
  return (
    <section
      aria-label="Identity"
      className="relative rounded-[2px] border border-soft-hairline border-t-[2px] border-t-inari-vermillion bg-warm-paper-raised px-6 py-6 sm:px-8 sm:py-7"
    >
      <span aria-hidden="true" lang="ja" className="absolute right-6 bottom-5 font-display text-xl text-inari-vermillion/65">友</span>
      <header className="mb-5 flex items-center justify-between">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-faded-sumi">Profile · /{stub.handle}</p>
        <EditLink />
      </header>
      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-6 gap-y-1.5 text-sm">
        <CatalogRow term="Name"   value={displayName} />
        <CatalogRow term="Target" value={formatJlptLevel(jlptTarget)} />
        <CatalogRow term="Joined" value={formatJoinedMonth(joinedAt)} />
        <CatalogRow term="From"   value={stub.location} />
      </dl>
      <div aria-hidden="true" className="my-5 h-px bg-soft-hairline" />
      <p className="max-w-[58ch] pr-8 text-[0.9375rem] leading-relaxed text-sumi-ink">{stub.bio}</p>
    </section>
  )
}

function CatalogRow({ term, value }: { term: string; value: string }): React.JSX.Element {
  return (
    <>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">{term}</dt>
      <dd className="font-mono tabular-nums text-sumi-ink">{value}</dd>
    </>
  )
}

/** M4 — Stamped. Kitsune 友 at hero scale to the left; identity column to
 *  the right. The most "brand-amplified moment" of the four — closest to
 *  the auth surface in register, while still product chrome below. */
function MastheadStamped({ displayName, jlptTarget, joinedAt, stub }: MastheadProps): React.JSX.Element {
  return (
    <section aria-label="Identity" className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-6 sm:gap-10">
      <div className="relative flex h-36 w-36 shrink-0 items-center justify-center sm:h-44 sm:w-44">
        <span aria-hidden="true" className="absolute inset-0 rounded-[2px] bg-vermillion-wash" />
        <span
          aria-hidden="true"
          lang="ja"
          className="relative select-none font-display text-[7.5rem] leading-none text-inari-vermillion sm:text-[9rem]"
        >
          友
        </span>
      </div>
      <div className="min-w-0 pt-2 sm:pt-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-medium leading-tight text-sumi-ink sm:text-[2.25rem]">
              {displayName}
            </h2>
            <p className="mt-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
              /{stub.handle}
              <span className="mx-2 text-faded-sumi/45">·</span>
              {formatJlptLevel(jlptTarget)}
              <span className="mx-2 text-faded-sumi/45">·</span>
              since {formatJoinedMonth(joinedAt)}
              <span className="mx-2 text-faded-sumi/45">·</span>
              {stub.location}
            </p>
          </div>
          <EditLink />
        </header>
        <p className="mt-5 max-w-[58ch] text-base leading-relaxed text-sumi-ink">{stub.bio}</p>
      </div>
    </section>
  )
}
