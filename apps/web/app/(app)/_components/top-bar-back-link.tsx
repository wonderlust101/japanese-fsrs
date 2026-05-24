import Link from 'next/link'

interface TopBarBackLinkProps {
  /** Destination route for the back navigation. */
  href: string
  /** Accessible label describing where the link returns to. */
  ariaLabel: string
}

// Compact back affordance used on detail/breadcrumb pages, placed to the LEFT
// of the TopBarTitle. Single arrow glyph; the hanko + page title that follow
// it carry the contextual labeling. Desktop-only: on mobile the TopBar shows
// the brand mark and the drawer handles navigation, so the back link hides
// below lg to keep the mobile chrome a clean brand-mark + actions row.
export function TopBarBackLink({ href, ariaLabel }: TopBarBackLinkProps): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="hidden shrink-0 items-center justify-center w-8 h-8 -ml-1 rounded-[2px] text-faded-sumi hover:text-sumi-ink hover:bg-cream-inset transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 lg:inline-flex"
    >
      <span aria-hidden="true" className="text-base leading-none">←</span>
    </Link>
  )
}
