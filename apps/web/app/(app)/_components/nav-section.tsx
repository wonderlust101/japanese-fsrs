interface NavSectionProps {
  label:    string
  children: React.ReactNode
}

/**
 * Section-grouped wrapper for nav items. Quiet uppercase label above; items
 * listed below. Used identically by the desktop Sidebar and the MobileDrawer
 * so both chrome surfaces share visual rhythm.
 */
export function NavSection({ label, children }: NavSectionProps): React.JSX.Element {
  return (
    <div className="px-2 first:pt-1">
      <h2 className="px-3 pt-4 pb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-faded-sumi">
        {label}
      </h2>
      <ul className="space-y-1">
        {children}
      </ul>
    </div>
  )
}
