"use client";

import { RouteErrorBoundary } from "@/app/_components/route-error-boundary";

/**
 * Error boundary for the public marketing route group (landing, privacy,
 * terms, help). Renders inside `MarketingLayout`, so the nav and footer stay
 * mounted and the visitor keeps a way out; offers a path back to the landing
 * page.
 *
 * `inshell` (not `fullbleed`): `MarketingLayout` already renders the page
 * `<main>`; a fullbleed boundary would nest a second `<main>`.
 */
interface ErrorBoundaryProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function MarketingError({ error, reset }: ErrorBoundaryProps): React.JSX.Element {
	return (
		<RouteErrorBoundary
			error={error}
			reset={reset}
			variant="inshell"
			source="(marketing) error boundary"
			backHref="/"
			backLabel="Back to home"
		/>
	);
}
