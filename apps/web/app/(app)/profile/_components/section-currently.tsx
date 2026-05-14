'use client'

import type { StubCurrently } from './profile-stub-data'

export type CurrentlyVariant = 'word' | 'deck' | 'sentence' | 'line'

export const CURRENTLY_VARIANTS: readonly CurrentlyVariant[] = [
  'word', 'deck', 'sentence', 'line',
]

export const CURRENTLY_META: Record<CurrentlyVariant, { short: string; label: string; blurb: string }> = {
  word:     { short: 'Cu1', label: 'Word',     blurb: 'Card. Kanji at hero scale. Japanese is the hero.' },
  deck:     { short: 'Cu2', label: 'Deck',     blurb: 'Card. Deck name + progress dominant; word as subhead.' },
  sentence: { short: 'Cu3', label: 'Sentence', blurb: 'Card. Contextual sentence is the visual.' },
  line:     { short: 'Cu4', label: 'Line',     blurb: 'No card. Single typographic line. Most Are.na-quiet.' },
}

interface CurrentlyProps {
  variant:   CurrentlyVariant
  currently: StubCurrently
  /** When true, the section is already inside an outer card (V2 chrome)
   *  so Cu1/Cu2/Cu3 must skip their internal CardShell. DESIGN.md
   *  explicitly bans nested cards. */
  inCard?:   boolean
}

export function CurrentlySection({ variant, currently, inCard = false }: CurrentlyProps): React.JSX.Element {
  switch (variant) {
    case 'word':     return <CurrentlyWord     currently={currently} inCard={inCard} />
    case 'deck':     return <CurrentlyDeck     currently={currently} inCard={inCard} />
    case 'sentence': return <CurrentlySentence currently={currently} inCard={inCard} />
    case 'line':     return <CurrentlyLine     currently={currently} />
  }
}

interface InnerProps { currently: StubCurrently; inCard?: boolean }

/** The 2px-vermillion-stripe card shell used by Cu1, Cu2, Cu3. Cu4 opts
 *  out and uses page typography instead. When `inCard` is true the shell
 *  collapses to a bare fragment, so V2's outer dashboard card chrome
 *  isn't doubled. */
function CardShell({
  children, inCard = false,
}: {
  children: React.ReactNode
  inCard?:  boolean
}): React.JSX.Element {
  if (inCard) return <>{children}</>
  return (
    <article className="relative rounded-[2px] border border-soft-hairline border-t-[2px] border-t-inari-vermillion bg-warm-paper-raised px-6 py-7 sm:px-8 sm:py-8">
      {children}
    </article>
  )
}

/** Cu1 — Word-led. Kanji at display scale. The "Japanese is the hero" choice. */
function CurrentlyWord({ currently, inCard = false }: InnerProps): React.JSX.Element {
  return (
    <CardShell inCard={inCard}>
      <p lang="ja" className="font-display text-[4rem] leading-none text-sumi-ink sm:text-[5rem]">
        {currently.word}
      </p>
      <p className="mt-3 text-base text-sumi-ink">
        <span lang="ja" className="text-faded-sumi">{currently.reading}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span>{currently.meaning}</span>
      </p>
      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span>{currently.deckName}</span>
        <span className="text-faded-sumi/45">·</span>
        <span className="tabular-nums">{currently.seenIn} / {currently.total} cards seen</span>
        <span className="text-faded-sumi/45">·</span>
        <span>next review tomorrow</span>
      </div>
    </CardShell>
  )
}

/** Cu2 — Deck-led. Progress bar is the visual; word sits as a subhead.
 *  When the deck is private, an eyebrow lock chip surfaces so a public
 *  visitor sees that the deck is the owner's private practice
 *  (still showing name + progress, but signaling that the cards
 *  themselves aren't shared). */
function CurrentlyDeck({ currently, inCard = false }: InnerProps): React.JSX.Element {
  const pct = Math.round((currently.seenIn / currently.total) * 100)
  return (
    <CardShell inCard={inCard}>
      {currently.isPrivate && (
        <p className="mb-3 inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-faded-sumi">
          <LockGlyph />
          <span>Private deck</span>
        </p>
      )}
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-2xl font-medium text-sumi-ink">{currently.deckName}</p>
        <p className="font-mono tabular-nums text-sm text-sumi-ink">
          {currently.seenIn} / {currently.total}
        </p>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-[1px] bg-cool-paper-shade">
        <div className="h-full rounded-[1px] bg-inari-vermillion" style={{ width: `${pct}%` }} />
      </div>
      {currently.isPrivate ? (
        <p className="mt-5 text-sm text-faded-sumi">
          Cards are kept private. Progress is shared.
        </p>
      ) : (
        <p className="mt-5 text-sm text-faded-sumi">
          Currently working on{' '}
          <span lang="ja" className="text-sumi-ink">{currently.word}</span>
          <span className="mx-1.5">·</span>
          <span lang="ja">{currently.reading}</span>
          <span className="mx-1.5 text-faded-sumi/45">·</span>
          <span>{currently.meaning}.</span>
        </p>
      )}
    </CardShell>
  )
}

function LockGlyph(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className="text-faded-sumi">
      <rect
        x="2.5"
        y="5.5"
        width="7"
        height="5"
        rx="0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M3.75 5.5V3.75a2.25 2.25 0 0 1 4.5 0V5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Cu3 — Sentence-led. The context sentence is the visual; the word
 *  appears highlighted within it. */
function CurrentlySentence({ currently, inCard = false }: InnerProps): React.JSX.Element {
  const parts = currently.sentence.ja.split(currently.word)

  return (
    <CardShell inCard={inCard}>
      <p lang="ja" className="text-2xl leading-relaxed text-sumi-ink sm:text-[1.625rem]">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 ? (
              <span className="bg-vermillion-wash px-[0.15em] text-inari-vermillion-deep">
                {currently.word}
              </span>
            ) : null}
          </span>
        ))}
      </p>
      <p className="mt-3 text-sm italic text-faded-sumi">{currently.sentence.en}</p>
      <div className="mt-6 border-t border-soft-hairline pt-4 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        <span lang="ja" className="text-sumi-ink">{currently.word}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span lang="ja">{currently.reading}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span>{currently.meaning}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span>{currently.deckName}</span>
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span className="tabular-nums">{currently.seenIn} / {currently.total}</span>
      </div>
    </CardShell>
  )
}

/** Cu4 — Line. No card chrome. A single typographic line in the page's
 *  natural rhythm. The Are.na counter-statement. */
function CurrentlyLine({ currently }: InnerProps): React.JSX.Element {
  return (
    <div className="py-2">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg leading-relaxed text-sumi-ink">
        <span lang="ja" className="font-display text-2xl text-sumi-ink">{currently.word}</span>
        <span lang="ja" className="text-faded-sumi">{currently.reading}</span>
        <span className="text-faded-sumi/45">·</span>
        <span>{currently.meaning}</span>
      </p>
      <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
        in {currently.deckName}
        <span className="mx-2 text-faded-sumi/45">·</span>
        <span className="tabular-nums">{currently.seenIn} / {currently.total} seen</span>
      </p>
    </div>
  )
}
