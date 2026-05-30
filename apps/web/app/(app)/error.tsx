"use client";

import { RouteErrorBoundary } from "@/app/_components/route-error-boundary";

/**
 * In-shell error boundary for authenticated app routes. Catches errors thrown
 * inside any `(app)/*` page; because the boundary renders inside the `(app)`
 * layout, the sidebar + top-bar stay visible and the user keeps a clear escape
 * via the existing nav — hence no inline back link. Errors thrown by the
 * `(app)` layout itself bubble up to the root boundary, which renders full-bleed.
 *
 * `inshell` (not `fullbleed`): the `(app)` layout already paints the page
 * background + chrome. The shared composition lives in `RouteErrorBoundary`.
 */
interface ErrorBoundaryProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function AppError({ error, reset }: ErrorBoundaryProps): React.JSX.Element {
	return (
		<RouteErrorBoundary
			error={error}
			reset={reset}
			variant="inshell"
			source="(app) error boundary"
		/>
	);
}
