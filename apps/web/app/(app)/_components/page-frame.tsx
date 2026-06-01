interface PageFrameProps {
	children: React.ReactNode;
	/**
	 * When `true`, content vertically centers within the available viewport
	 * on desktop (lg+). Mobile and tablet stay top-aligned regardless. Use
	 * for short hub-style closure pages (review setup, drill setup, review
	 * summary, post-session screens) where the content has a natural
	 * "single beat" density. Default `false` keeps content top-anchored
	 * for scrollable list / detail pages.
	 */
	desktopCentered?: boolean;
	/**
	 * Optional ref onto the inner content-grid div (the node that holds the
	 * page's direct children). Page-level section-reveal (`useRevealMount`)
	 * attaches here so a single `rootRef` spans the `PageHeader` lead and the
	 * `SectionCard` cascade WITHOUT introducing a wrapper div that would break
	 * the grid's inter-child gap rhythm. This grid div carries no `page-enter`
	 * keyframe of its own, so there is no double-animation (constraint #4): the
	 * reveal owns `opacity`/`y` on the section children, not the frame.
	 */
	contentRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Canonical page-content frame for every (app) route.
 *
 * One source of truth for outer padding, max-width, vertical rhythm, and
 * optional desktop vertical-centering. Consumes the full main-content
 * height (it's a `flex-1` child of the parent <main>), so the inner grid
 * can resolve `content-center` against a real height.
 *
 * Mobile is always top-aligned. Padding scales:
 *   • base   — `px-4 pt-6 pb-20`
 *   • md+    — `px-12 pt-10 pb-16`
 *   • lg+    — `px-16 pt-12 pb-20`
 *
 * Inter-child rhythm:
 *   • base — `gap-y-8`
 *   • lg+  — `gap-y-10`
 *
 * Children are direct grid items; long pages stack naturally without
 * any per-page spacing tweaks. If a page packs multiple sections with
 * their own internal spacing, those still compose because the grid
 * only sets the *gap between direct children*, not internal layout.
 */
export function PageFrame({
	children,
	desktopCentered = false,
	contentRef,
}: PageFrameProps): React.JSX.Element {
	return (
		<div className="flex min-h-[calc(100dvh-4rem)] flex-col">
			<div className="relative isolate flex flex-1 flex-col">
				<div
					ref={contentRef}
					className={[
						"content-start relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1",
						"gap-y-8 px-4 pt-6 pb-30",
						"md:px-12 md:pb-16 md:pt-10",
						"lg:gap-y-10 lg:px-16 lg:py-12",
						desktopCentered ? "lg:content-center" : "",
					].filter(c => c.length > 0).join(" ")}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
