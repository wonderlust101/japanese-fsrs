/**
 * Editorial section marker: a small vermillion bullet + mono small-caps
 * label. Used to name the page's sections so they read as a printed
 * register rather than a continuous chrome flow.
 *
 * Rendered above the utility row ("Filter") and the deck list ("Decks").
 * Decorative; aria-hidden so the section landmarks (the utility row's
 * own aria-label and the deck list's section label) remain the
 * accessibility anchors.
 */
export function SectionMarker({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-1.5 select-none"
    >
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-inari-vermillion" />
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
        {label}
      </span>
    </div>
  )
}
