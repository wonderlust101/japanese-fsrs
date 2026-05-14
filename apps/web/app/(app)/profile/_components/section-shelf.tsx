'use client'

import type { StubSharedDeck } from './profile-stub-data'

export type ShelfVariant = 'indexed' | 'mini' | 'twocol' | 'grid'

export const SHELF_VARIANTS: readonly ShelfVariant[] = [
  'indexed', 'mini', 'twocol', 'grid',
]

export const SHELF_META: Record<ShelfVariant, { short: string; label: string; blurb: string }> = {
  indexed: { short: 'S1', label: 'Indexed',  blurb: '01/02/03 mono prefix. Library-index discipline.' },
  mini:    { short: 'S2', label: 'Mini row', blurb: 'Horizontal flex of tiny deck cards with 2px stripe.' },
  twocol:  { short: 'S3', label: 'Two-col',  blurb: 'Name+subtitle left, count right. Most Are.na.' },
  grid:    { short: 'S4', label: 'Grid',     blurb: 'Two-column responsive tiles. Most expressive.' },
}

interface ShelfProps {
  variant: ShelfVariant
  shelf:   StubSharedDeck[]
}

export function ShelfSection({ variant, shelf }: ShelfProps): React.JSX.Element {
  switch (variant) {
    case 'indexed': return <ShelfIndexed shelf={shelf} />
    case 'mini':    return <ShelfMini    shelf={shelf} />
    case 'twocol':  return <ShelfTwoCol  shelf={shelf} />
    case 'grid':    return <ShelfGrid    shelf={shelf} />
  }
}

function levelLabel(jlpt: StubSharedDeck['jlpt']): string {
  if (jlpt === null) return ''
  if (jlpt === 'beyond') return 'Beyond JLPT'
  return jlpt
}

interface InnerProps { shelf: StubSharedDeck[] }

/** S1 — Indexed. Numbered rows with mono prefix. Library-index discipline.
 *  When the shelf has more than 5 decks, shows the first 5 and a quiet
 *  "see more" affordance — same truncate-and-link pattern the dashboard
 *  uses for long lists. */
const SHELF_VISIBLE_LIMIT = 5

function ShelfIndexed({ shelf }: InnerProps): React.JSX.Element {
  const isTruncated = shelf.length > SHELF_VISIBLE_LIMIT
  const visible     = isTruncated ? shelf.slice(0, SHELF_VISIBLE_LIMIT) : shelf
  const hiddenCount = shelf.length - visible.length

  return (
    <div>
      <ul className="grid">
        {visible.map((d, i) => (
          <li
            key={d.id}
            className={[
              'grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-4 py-3',
              i < visible.length - 1 ? 'border-b border-soft-hairline' : '',
            ].join(' ')}
          >
            <span className="font-mono text-[0.75rem] tabular-nums text-faded-sumi">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-sm font-medium text-sumi-ink">{d.name}</p>
              <p className="text-xs text-faded-sumi">{d.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="font-mono tabular-nums text-sm text-sumi-ink">{d.cardCount}</p>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
                {levelLabel(d.jlpt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {isTruncated && (
        <button
          type="button"
          className="group mt-4 inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion ui-motion-colors hover:text-inari-vermillion-deep"
        >
          <span>See {hiddenCount} more</span>
          <span aria-hidden="true" className="ui-motion-transform group-hover:translate-x-0.5">→</span>
        </button>
      )}
    </div>
  )
}

/** S2 — Mini row. Horizontal deck cards with 2px vermillion stripe.
 *  Mirrors the DESIGN.md card-stack identity at deck-card scale. Sized
 *  to read as real cards on the shelf, not as miniatures. */
function ShelfMini({ shelf }: InnerProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
      {shelf.map((d) => (
        <article
          key={d.id}
          className="flex h-full flex-col rounded-[2px] border border-soft-hairline border-t-[2px] border-t-inari-vermillion bg-warm-paper-raised px-5 py-5 sm:px-6 sm:py-6"
        >
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
            {levelLabel(d.jlpt)}
          </p>
          <p className="mt-2.5 text-base font-medium leading-snug text-sumi-ink">{d.name}</p>
          <p className="mt-1.5 text-sm leading-snug text-faded-sumi">{d.subtitle}</p>
          <p className="mt-5 font-mono tabular-nums text-sm text-sumi-ink">
            {d.cardCount}
            <span className="ml-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
              cards
            </span>
          </p>
        </article>
      ))}
    </div>
  )
}

/** S3 — Two-column. Name + subtitle left, card count right-aligned in mono.
 *  Quietest variant — Are.na index sensibility. */
function ShelfTwoCol({ shelf }: InnerProps): React.JSX.Element {
  return (
    <ul className="grid">
      {shelf.map((d, i) => (
        <li
          key={d.id}
          className={[
            'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-6 py-3.5',
            i < shelf.length - 1 ? 'border-b border-soft-hairline' : '',
          ].join(' ')}
        >
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] text-sumi-ink">{d.name}</p>
            <p className="mt-0.5 truncate text-xs text-faded-sumi">{d.subtitle}</p>
          </div>
          <p className="font-mono tabular-nums text-sm text-faded-sumi">
            <span className="text-sumi-ink">{d.cardCount}</span>
            <span className="ml-1.5">cards</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

/** S4 — Grid. 2-column responsive tiles with a vermillion JLPT kanji on
 *  the left and meta on the right. Most expressive of the four. */
function ShelfGrid({ shelf }: InnerProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {shelf.map((d) => (
        <article
          key={d.id}
          className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-stretch gap-4 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-4 py-4"
        >
          <div className="flex items-center justify-center rounded-[2px] bg-vermillion-wash">
            <span
              lang="ja"
              className="font-display text-2xl leading-none text-inari-vermillion"
            >
              {jlptKanji(d.jlpt)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
              {levelLabel(d.jlpt)}
            </p>
            <p className="mt-1 text-sm font-medium leading-snug text-sumi-ink">{d.name}</p>
            <p className="mt-1 text-xs text-faded-sumi">{d.subtitle}</p>
            <p className="mt-2 font-mono tabular-nums text-xs text-sumi-ink">{d.cardCount} cards</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function jlptKanji(jlpt: StubSharedDeck['jlpt']): string {
  if (jlpt === 'beyond') return '彼'
  if (jlpt === null) return '・'
  return jlpt.replace('N', '')
}
