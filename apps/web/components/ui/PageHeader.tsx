import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** Single kanji or 2-char compound rendered in vermillion display register
   *  as the leading ornament. Same scale as the eyebrows on Today, Setup, and
   *  the Session top bar. */
  kanji:    string
  /** Small-caps mono label rendered after the kanji. Capitalisation is up to
   *  the caller; the CSS uppercases it. */
  label:    string
  /** Display-register page title. Renders the existing
   *  `text-[1.65rem] sm:text-[1.95rem] lg:text-[2.25rem]` step. */
  title:    string
  /** Optional sub-line in faded sumi, capped at `max-w-prose`. */
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
        <p className="flex items-baseline gap-3 font-mono text-sm uppercase tracking-[0.16em] text-faded-sumi">
          <span
            lang="ja"
            aria-hidden="true"
            className="font-display text-lg leading-none translate-y-[0.05em] text-inari-vermillion"
          >
            {kanji}
          </span>
          <span>{label}</span>
        </p>
        <h1 className="mt-3 font-display font-medium text-sumi-ink text-[1.65rem] sm:text-[1.95rem] lg:text-[2.25rem]">
          {title}
        </h1>
        {subtitle !== undefined && (
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-faded-sumi lg:text-base">
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
