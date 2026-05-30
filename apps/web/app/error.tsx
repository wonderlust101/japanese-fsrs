"use client";

import { RouteErrorBoundary } from "@/app/_components/route-error-boundary";

/**
 * Root error boundary. Renders full-bleed so it survives even when the app
 * shell itself is responsible for the failure (a broken sidebar, a corrupted
 * top-bar state). Next.js requires this file to be a Client Component because
 * it receives `reset`, a function that isn't serializable across the
 * server/client boundary.
 *
 * `fullbleed` (the only boundary that uses it): the root layout renders no
 * `<main>`, so this is the sole landmark. The shared composition — practice-
 * paused voice, soft-retry escalation, report, dev panel — lives in
 * `RouteErrorBoundary`.
 */
interface ErrorBoundaryProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function RootError({ error, reset }: ErrorBoundaryProps): React.JSX.Element {
	return (
		<RouteErrorBoundary
			error={error}
			reset={reset}
			variant="fullbleed"
			source="root error boundary"
			backHref="/today"
			backLabel="Back to home"
		/>
	);
}
