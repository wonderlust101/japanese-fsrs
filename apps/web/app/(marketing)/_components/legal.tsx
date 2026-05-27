import type { ReactNode } from 'react'

import { DocShell, type TocEntry } from './marketing-doc'

/**
 * Shared chrome for the long-form legal pages (Privacy, Terms). It renders the
 * marketing `DocShell` (branded header band + ghosted kanji + sticky table of
 * contents) and keeps the "draft for review" counsel notice and reading measure
 * identical across both so they never drift. Body copy uses Sumi Ink (not Faded
 * Sumi) to hold long-form reading at AAA contrast per PRODUCT.md.
 *
 * The counsel notice is intentional and visible: the copy below is a starting
 * template, not legal advice. It must be reviewed and adapted before launch.
 */
export function LegalShell({
  title,
  updated,
  intro,
  kanji,
  toc,
  children,
}: {
  title: string
  updated: string
  intro: string
  kanji: string
  toc: readonly TocEntry[]
  children: ReactNode
}): React.JSX.Element {
  return (
    <DocShell kicker="Legal" title={title} lede={intro} meta={`Last updated ${updated}`} kanji={kanji} toc={toc}>
      <div className="flex flex-col gap-16">{children}</div>
    </DocShell>
  )
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string
  heading: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section
      id={id}
      data-doc-reveal
      aria-labelledby={`${id}-h`}
      className="scroll-mt-24 flex flex-col gap-4 border-t border-soft-hairline pt-12 first:border-t-0 first:pt-0"
    >
      <h2
        id={`${id}-h`}
        className="font-display text-xl font-semibold tracking-[-0.01em] text-sumi-ink md:text-2xl"
      >
        {heading}
      </h2>
      {children}
    </section>
  )
}

export function LegalP({ children }: { children: ReactNode }): React.JSX.Element {
  // measure-wide (72ch) keeps long-form reading inside the 65–75ch comfort band
  // while filling more of the widened (1440px) content column.
  return <p className="max-w-measure-wide text-base leading-[1.7] text-sumi-ink">{children}</p>
}

/** Enumerated clauses (rights, legal bases, subprocessors). Vermillion markers
 *  keep lists tied to the brand without a side-stripe. */
export function LegalList({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <ul className="flex max-w-measure-wide list-disc flex-col gap-2 pl-5 text-base leading-[1.7] text-sumi-ink marker:text-inari-vermillion">
      {children}
    </ul>
  )
}
