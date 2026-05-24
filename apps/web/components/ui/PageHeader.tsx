import type { ReactNode } from 'react'

import { KanjiLabel } from './KanjiLabel'

/**
 * Canonical vertical padding for a page header inside a content container.
 * One source of truth so cards / decks / insights / settings headers share the
 * same title-to-content rhythm instead of each copying a literal that drifts
 * (the decks family had quietly diverged to a tighter pb ladder).
 */
export const PAGE_HEADER_PADDING = 'pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-8'

interface PageHeaderProps {
  /** Single kanji or 2-char compound rendered in vermillion display register
   *  as the leading ornament. Same scale as the eyebrows on Today, Setup, and
   *  the Session top bar. */
  kanji:    string
  /** Small-caps mono label rendered after the kanji. Capitalisation is up to
   *  the caller; the CSS uppercases it. */
  label:    string
  /** Display-register page title. Renders the existing
   *  `text-title` step. */
  title:    string
  /** Optional sub-line in faded sumi, capped at `max-w-measure`. */
  subtitle?: string
  /** Optional right-aligned slot for surface-level affordances (e.g. an
   *  "advanced" link). Hidden below `sm` to keep small screens calm. */
  rightSlot?: ReactNode
}

/**
 * Canonical Tomo page header: kanji eyebrow + display headline + sub-line.
 *
 * Tomo's pages (Today, Review Setup, future Add) share this rhythm. Extracted
 * from the inlined `<header>` in `review/setup/_components/setup-client.tsx`
 * so /add and future pages can reuse it without copy-pasting the type scale.
 *
 * Today's `GreetingHeader` deliberately stays separate — it has hydration-only
 * Japanese eyebrow + warm-clause logic that doesn't fit this static contract.
 */
export function PageHeader({
  kanji,
  label,
  title,
  subtitle,
  rightSlot,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <p className="flex items-baseline gap-3">
          <KanjiLabel kanji={kanji} label={label} variant="eyebrow" />
        </p>
        <h1 className="mt-3 font-display font-medium text-sumi-ink text-title">
          {title}
        </h1>
        {subtitle !== undefined && (
          <p className="mt-1 max-w-measure text-sm leading-relaxed text-faded-sumi lg:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot !== undefined && (
        <div className="hidden sm:flex shrink-0 items-center">{rightSlot}</div>
      )}
    </header>
  )
}
