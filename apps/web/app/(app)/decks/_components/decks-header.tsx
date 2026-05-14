import React from 'react'

/**
 * Editorial header for the Library page (V5-promoted production design).
 *
 * Composition:
 *   - A mono small-caps eyebrow "YOUR STUDY SHELF · TOMO" names the page
 *     as a printed register would.
 *   - The "Library" title in Bricolage display.
 *   - The dynamic status sub-line in DM Sans body type.
 *
 * All three lines live inside a tinted panel (Cool Paper Shade background,
 * 1px Soft Hairline border) that gives the title block its own visual
 * region distinct from the utility row and deck list below.
 *
 * The faint right-side 書 kanji watermark that the earlier baseline
 * carried is removed: the panel's tinted background takes over as the
 * title region's brand-mark presence.
 *
 * Page-scope ornaments — a 2px vermillion top rule across the page and a
 * 1px vermillion left margin rule running floor-to-ceiling — are rendered
 * by the orchestrator (deck-list.tsx) around this header.
 */

export interface DecksHeaderProps {
  variant: HeaderVariant
}

export type HeaderVariant =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty' }
  | { kind: 'search'; query: string; matchedCount: number; totalCount: number }
  | { kind: 'default'; activeCount: number; archivedCount: number; priorityDeckName: string | null }

export function DecksHeader({ variant }: DecksHeaderProps): React.JSX.Element {
  const subline = buildSubline(variant)

  return (
    <header
      aria-labelledby="library-heading"
      className="pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-7"
    >
      <div className="relative max-w-[44rem] rounded-[2px] border border-soft-hairline bg-cool-paper-shade/55 p-5 sm:p-6 lg:p-7">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
          Your study shelf · Tomo
        </p>

        <h1
          id="library-heading"
          className="mt-2 font-display font-medium leading-[1.06] tracking-[-0.012em] text-sumi-ink text-[2.25rem] sm:text-[2.625rem] lg:text-[3rem] text-balance"
        >
          Library
        </h1>

        <p
          aria-live="polite"
          className="mt-2 text-sm font-normal leading-relaxed text-faded-sumi sm:mt-2.5"
        >
          {subline}
        </p>
      </div>
    </header>
  )
}

function buildSubline(variant: HeaderVariant): React.ReactNode {
  switch (variant.kind) {
    case 'loading':
      return 'Loading your decks.'

    case 'error':
      return "Couldn't reach your decks."

    case 'empty':
      return 'Empty for now. Find a deck to begin.'

    case 'search':
      return (
        <>
          <span className="font-mono tabular-nums text-sumi-ink/85">{variant.totalCount}</span>
          {' decks. '}
          <span className="font-mono tabular-nums text-sumi-ink/85">{variant.matchedCount}</span>
          {' matching '}
          <span className="text-sumi-ink/85">'{variant.query}'</span>
          {'.'}
        </>
      )

    case 'default': {
      const { activeCount, archivedCount, priorityDeckName } = variant
      const parts: React.ReactNode[] = [
        <React.Fragment key="active">
          <span className="font-mono tabular-nums text-sumi-ink/85">{activeCount}</span>
          {` active deck${activeCount === 1 ? '' : 's'}`}
        </React.Fragment>,
      ]
      if (archivedCount > 0) {
        parts.push(
          <React.Fragment key="archived">
            <span className="font-mono tabular-nums">{archivedCount}</span>
            {` archived`}
          </React.Fragment>,
        )
      }
      if (priorityDeckName !== null && activeCount > 0) {
        parts.push(
          <React.Fragment key="priority">
            Slot <span className="font-mono tabular-nums">01</span> is{' '}
            <span className="text-sumi-ink/85">{truncateName(priorityDeckName, 28)}</span>
          </React.Fragment>,
        )
      }
      return interleave(parts, <span aria-hidden="true" className="mx-2 text-faded-sumi/55">·</span>)
    }
  }
}

function truncateName(name: string, max: number): string {
  if (name.length <= max) return name
  return name.slice(0, max - 1).trimEnd() + '…'
}

function interleave(nodes: React.ReactNode[], separator: React.ReactNode): React.ReactNode[] {
  const out: React.ReactNode[] = []
  nodes.forEach((node, i) => {
    if (i > 0) out.push(<React.Fragment key={`sep-${i}`}>{separator}</React.Fragment>)
    out.push(node)
  })
  return out
}
