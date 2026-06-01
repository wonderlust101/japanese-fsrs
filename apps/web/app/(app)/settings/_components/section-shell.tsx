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
	heading,
	contentRef,
}: {
	children: React.ReactNode;
	strip?: React.ReactNode;
	/**
	 * Visually-hidden page <h1> for this settings sub-route. Each leaf section
	 *  passes its page title so the document outline is h1 → h2 (SectionCard
	 *  label) → h3, instead of starting at the SectionCard's h2.
	 */
	heading?: string;
	/**
	 * Optional ref onto the content column (the node wrapping the section's
	 * `SectionCard`). A per-section `useRevealMount` attaches here for the single
	 * SectionCard settle (no lead, no stagger). Default undefined leaves the
	 * section static.
	 */
	contentRef?: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element {
	return (
		<>
			<div className="min-w-0 flex-1" ref={contentRef}>
				{heading !== undefined && <h1 className="sr-only">{heading}</h1>}
				{children}
			</div>
			{strip ?? null}
		</>
	);
}
