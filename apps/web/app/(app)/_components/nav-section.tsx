interface NavSectionProps {
  label:    string
  children: React.ReactNode
  /** True when this is the first section in the sidebar; suppresses the
   *  hairline divider above the label so it doesn't visually duplicate the
   *  brand-strip's bottom border. */
  isFirst?: boolean
}

/**
 * Section-grouped wrapper for nav items. The label uses Bricolage Grotesque
 * at the small-display register (~11px sentence case, font-medium, looser
 * tracking) so the section break carries a quiet typographic moment without
 * competing with the body copy below it. Non-first sections get a 1px Soft
 * Hairline divider above the label as editorial punctuation.
 */
export function NavSection({ label, children, isFirst = false }: NavSectionProps): React.JSX.Element {
  return (
    <div className="px-2">
      {!isFirst && <div aria-hidden="true" className="mx-3 my-2 h-px bg-soft-hairline" />}
      <h2 className="font-display tracking-[0.04em] px-3 pt-3 pb-2 text-sm font-normal text-faded-sumi">
        {label}
      </h2>
      <ul className="space-y-1">
        {children}
      </ul>
    </div>
  )
}
