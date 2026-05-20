/**
 * Per-page wrapper for a settings section. Pairs the section's main
 * `<SectionCard>` with its right `<ContextStrip>` (if any) and slots both
 * into the layout's two-column rail+content flex. Every leaf section uses
 * this so the layout never has to know about its children's internals.
 *
 * On <xl breakpoints the strip hides itself; this shell still works as
 * "card on the right of the rail" without any further changes.
 */
export function SectionShell({
  children,
  strip,
}: {
  children: React.ReactNode
  strip?:   React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <div className="min-w-0 flex-1">
        {children}
      </div>
      {strip ?? null}
    </>
  )
}
