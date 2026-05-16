import Link from 'next/link'

import { QuietLink } from '@/components/ui/QuietLink'

export interface ExitLink {
  href:  string
  label: string
}

interface ExitLinksRowProps {
  /** ARIA label for the wrapping nav. Defaults to "More on Tomo". */
  ariaLabel?: string
  links:      ReadonlyArray<ExitLink>
}

/**
 * Quiet typographic outro row pinned to the bottom of a page's content stack.
 *
 * Renders a stacked list on mobile (each row is a 44px touch target with a
 * trailing arrow) and an inline `·`-separated row of QuietLinks on `sm+`.
 * Extracted from `today-client.tsx`'s inlined `ExitLinksRow`; visual treatment
 * is unchanged so Today reads identical after the swap.
 */
export function ExitLinksRow({
  ariaLabel = 'More on Tomo',
  links,
}: ExitLinksRowProps): React.JSX.Element {
  return (
    <nav aria-label={ariaLabel}>
      {/* Mobile: stacked rows */}
      <ul className="flex flex-col border-t border-soft-hairline sm:hidden">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={[
                'flex min-h-11 items-center justify-between gap-3 border-b border-soft-hairline px-1 py-2.5',
                'font-mono text-xs uppercase tracking-[0.10em] text-sumi-ink/80',
                'today-motion-colors',
                'hover:text-inari-vermillion active:bg-cream-inset/60',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45',
              ].join(' ')}
            >
              <span>{link.label}</span>
              <span
                aria-hidden="true"
                className="font-mono text-base leading-none text-faded-sumi/70"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* sm+: inline row with `·` separators */}
      <ul className="hidden flex-wrap items-center gap-x-3 gap-y-1 sm:flex">
        {links.map((link, index) => (
          <li key={link.href} className="flex items-center gap-x-3">
            {index > 0 && (
              <span aria-hidden="true" className="font-mono text-xs text-faded-sumi/45">
                ·
              </span>
            )}
            <QuietLink href={link.href} trailingArrow>
              {link.label}
            </QuietLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
