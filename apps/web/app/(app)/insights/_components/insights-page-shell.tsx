import type { ReactNode, RefObject } from "react";

import { PAGE_HEADER_PADDING } from "@/components/ui/PageHeader";

/**
 * Shared chrome for the Insights pages (Overview, Progress, Forecast,
 * Statistics). Centralizes the page background, the 1440px content container,
 * and the TopBar/header sequencing that each page used to copy-paste.
 *
 * Each page passes its own `topBar` (a titled <TopBar>) and, optionally, a
 * `header` node (a <PageHeader> wrapper, or nothing when the header is
 * data-derived and rendered inside `children`, as the Overview's masthead is).
 * Loading / error / empty branches reuse the same shell so the chrome stays
 * identical across every state.
 */
// `flex-1` (not `min-h-screen`): the shell is a flex child of the (app)
// layout's `<main>` (a flex column), sitting below the sticky 64px TopBar.
// `min-h-screen` forced the shell to a full 100vh, so TopBar + shell always
// overflowed the viewport by ~64px and the page scrolled even with no content.
// Filling the *remaining* main height instead means short pages don't scroll,
// while tall content still grows the shell and scrolls naturally.
const PAGE_SHELL_CLASS = "flex-1 bg-cool-paper-base";
// `@container/insights` makes this content column a query container, so the
// section grids inside pair up based on the column's own width rather than the
// viewport. That matters here because the sidebar collapses between w-16 and
// w-72: at a fixed viewport the available column can differ by ~224px, which a
// viewport breakpoint can't see but a container query reads directly.
const PAGE_CONTAINER_CLASS = "@container/insights mx-auto max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16";
// Centered fill region for loader / centerpiece states. `h-full` spans the
// shell's full available height (the area below the TopBar), so the loader
// sits at the true center of the content viewport regardless of how much
// header chrome a non-loading state would otherwise place above it.
const PAGE_FILL_CLASS = "flex h-full items-center justify-center px-6";

/** Exported for inner content components that need a centered loader but live
 *  inside an already-mounted `InsightsPageShell` (i.e. after the TopBar split). */
export const INSIGHTS_CONTENT_FILL_CLASS = "flex min-h-[60vh] items-center justify-center px-6";

/**
 * Padding wrapper for a page header inside the shell. Exported so each page's
 *  header component shares one spacing rhythm instead of redeclaring it.
 */
/**
 * @deprecated Alias of the app-wide {@link PAGE_HEADER_PADDING}; kept so the
 *  insights views import path doesn't churn. Prefer PAGE_HEADER_PADDING.
 */
export const INSIGHTS_HEADER_PADDING_CLASS = PAGE_HEADER_PADDING;

interface InsightsPageShellProps {
	topBar: ReactNode;
	header?: ReactNode;
	children: ReactNode;
	/**
	 * Center `children` in the available content area (below the TopBar) instead
	 * of flowing them inside the padded reading container. Used by the loading
	 * state so the page loader sits at the true viewport center, anchored to the
	 * shell rather than to whatever chrome would otherwise stack above it.
	 */
	fill?: boolean;
	/**
	 * Optional ref onto the padded content container (the node holding both the
	 * `header` and `children`). Page-level section-reveal (`useRevealScroll`)
	 * attaches here so a single `rootRef` spans the `PageHeader` lead and the
	 * `SectionCard` cascade. Inert in the `fill` branch (no content to reveal).
	 */
	contentRef?: RefObject<HTMLDivElement | null>;
}

export function InsightsPageShell({
	topBar,
	header,
	children,
	fill = false,
	contentRef,
}: InsightsPageShellProps): React.JSX.Element {
	return (
		<>
			{topBar}
			<div className={PAGE_SHELL_CLASS}>
				{fill
					? (
							<div className={PAGE_FILL_CLASS}>{children}</div>
						)
					: (
							<div className={PAGE_CONTAINER_CLASS} ref={contentRef}>
								{header}
								{children}
							</div>
						)}
			</div>
		</>
	);
}
