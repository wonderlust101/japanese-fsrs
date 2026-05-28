import type { ReactNode } from "react";

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
const PAGE_SHELL_CLASS = "min-h-screen bg-cool-paper-base pb-16";
// `@container/insights` makes this content column a query container, so the
// section grids inside pair up based on the column's own width rather than the
// viewport. That matters here because the sidebar collapses between w-16 and
// w-72: at a fixed viewport the available column can differ by ~224px, which a
// viewport breakpoint can't see but a container query reads directly.
const PAGE_CONTAINER_CLASS = "@container/insights mx-auto max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16";

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
}

export function InsightsPageShell({
	topBar,
	header,
	children,
}: InsightsPageShellProps): React.JSX.Element {
	return (
		<>
			{topBar}
			<div className={PAGE_SHELL_CLASS}>
				<div className={PAGE_CONTAINER_CLASS}>
					{header}
					{children}
				</div>
			</div>
		</>
	);
}
