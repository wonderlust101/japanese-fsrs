/**
 * Centralized error-reporting seam.
 *
 * Today this logs to the console. It exists so that wiring an external error
 * tracker (Sentry, etc.) later is a *single-file* change: replace the body
 * here, not the call sites. Call it from error boundaries and other catch
 * points that should be observable in production.
 *
 * Keep calls out of render (use an effect / event handler), so a tracker isn't
 * spammed on every re-render of an error surface.
 */
export interface ErrorContext {
	/** Where the error was caught, e.g. '(app) error boundary'. */
	source: string;
	/** Current route, when available. */
	pathname?: string | undefined;
	/** Next.js error digest, when available. */
	digest?: string | undefined;
	/** Any extra structured breadcrumbs. */
	extra?: Record<string, unknown> | undefined;
}

export function reportError(error: unknown, context: ErrorContext): void {
	// ── Extension point ──────────────────────────────────────────────────────
	// Forward to an external tracker here once a provider is chosen, e.g.:
	//   Sentry.captureException(error, { tags: { source: context.source }, extra: context })
	// Keep the console.error below so local dev and server logs stay useful.
	console.error(`[tomo] ${context.source}:`, error, context);
}
