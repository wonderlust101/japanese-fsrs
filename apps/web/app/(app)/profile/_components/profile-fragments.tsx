/**
 * Small UI fragments shared by the six Profile direction variants. Each
 * fragment renders one piece of repeating content (the inline fact line,
 * the 友 seal-mark, the sibling-card teaser body) so the per-direction
 * files can focus on their layout, not on rebuilding the same pieces.
 */

interface FactLineProps {
  targetLabel: string
  joinedLabel: string
  /** When true, stacks the two facts vertically instead of laying them out
   *  on a single inline line. Used by Solo / Postcard where vertical breath
   *  reads better than a dense inline run. */
  stacked?: boolean
}

export function FactLine({ targetLabel, joinedLabel, stacked = false }: FactLineProps): React.JSX.Element {
  if (stacked) {
    return (
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-x-6 gap-y-2 text-sm text-sumi-ink">
        <FactTerm term="Target" value={targetLabel} />
        <FactTerm term="Joined" value={joinedLabel} />
      </dl>
    )
  }

  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-sumi-ink">
      <InlineFact label="Target" value={targetLabel} />
      <span aria-hidden="true" className="text-faded-sumi/55">·</span>
      <InlineFact label="Joined" value={joinedLabel} />
    </p>
  )
}

function InlineFact({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        {label}
      </span>
      <span className="font-mono tabular-nums text-sumi-ink">{value}</span>
    </span>
  )
}

function FactTerm({ term, value }: { term: string; value: string }): React.JSX.Element {
  return (
    <>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        {term}
      </dt>
      <dd className="font-mono tabular-nums text-sumi-ink">{value}</dd>
    </>
  )
}

interface KitsuneSealProps {
  /** Position inside a relatively-positioned card. Defaults to bottom-right.
   *  Passed through as className so each variant can place the seal where
   *  its layout wants it. */
  className?: string
  /** Size of the 友 glyph. Defaults to text-2xl (24px). */
  size?: 'sm' | 'md' | 'lg'
}

export function KitsuneSeal({ className, size = 'md' }: KitsuneSealProps): React.JSX.Element {
  const sizeClass = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-3xl' : 'text-2xl'
  return (
    <span
      aria-hidden="true"
      lang="ja"
      title="Tomo"
      className={[
        'select-none font-display leading-none text-inari-vermillion/55',
        sizeClass,
        className ?? '',
      ].join(' ')}
    >
      友
    </span>
  )
}

interface SiblingTeaserProps {
  label: string
  body:  string
}

/**
 * The interior of a sibling card (Library, Kanji catalog) across all
 * variants: a mono uppercase label + a body line in Sumi Ink. The card
 * itself is rendered by the variant; this just composes the inside text.
 */
export function SiblingTeaser({ label, body }: SiblingTeaserProps): React.JSX.Element {
  return (
    <>
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-sumi-ink/65">
        {label}
      </p>
      <p className="mt-3 text-base text-sumi-ink/85">{body}</p>
    </>
  )
}

interface IdentityHeadingProps {
  name: string
  /** Display size. The variants use different scales: solo and postcard
   *  go larger; bento/roll/float keep the same as stack. */
  size?: 'md' | 'lg'
  id?:   string
}

export function IdentityHeading({ name, size = 'md', id }: IdentityHeadingProps): React.JSX.Element {
  const sizeClass = size === 'lg'
    ? 'text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem]'
    : 'text-[2.25rem] sm:text-[2.65rem]'

  return (
    <h2
      id={id}
      className={[
        'break-words font-display leading-[1.02] text-sumi-ink',
        sizeClass,
      ].join(' ')}
    >
      {name}
    </h2>
  )
}
