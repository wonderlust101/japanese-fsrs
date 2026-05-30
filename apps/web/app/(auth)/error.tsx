"use client";

import { RouteErrorBoundary } from "@/app/_components/route-error-boundary";

/**
 * Error boundary for the auth route group (`/login`, `/signup`, …). Catches
 * errors thrown by an auth page and renders in the form slot inside `AuthShell`
 * (which the layout keeps mounted), so the split-screen brand chrome stays put
 * and the user has a path back to sign in.
 *
 * `inshell` (not `fullbleed`): `AuthShell` already renders the page `<main>`;
 * a fullbleed boundary would nest a second `<main>`. See `RouteErrorBoundary`.
 */
interface ErrorBoundaryProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function AuthError({ error, reset }: ErrorBoundaryProps): React.JSX.Element {
	return (
		<RouteErrorBoundary
			error={error}
			reset={reset}
			variant="inshell"
			source="(auth) error boundary"
			backHref="/login"
			backLabel="Back to sign in"
		/>
	);
}
