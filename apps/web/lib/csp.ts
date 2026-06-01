/**
 * Builds the per-request `Content-Security-Policy` header value.
 *
 * The policy is nonce-based: a fresh nonce is minted per request in
 * `middleware.ts` and stamped into `script-src` here. Paired with
 * `'strict-dynamic'`, this lets Next.js's own bootstrap scripts — which inherit
 * the nonce automatically because middleware also sets the CSP on the *request*
 * headers — load the rest of the chunk graph, while any injected inline script
 * that lacks the nonce is blocked. That inline-script lever is the actual XSS
 * vector this policy closes.
 *
 * Deliberate relaxations:
 *  - `style-src 'unsafe-inline'`: React `style={}` attributes and Next's
 *    injected `<style>` blocks can't carry a nonce, so inline styles must be
 *    allowed. Tailwind's output is a static stylesheet served from `'self'`, so
 *    the inline-style surface is small and style injection is a weak vector.
 *  - `img-src ... data: blob:`: `next/image` and inline SVG/blur placeholders.
 *  - `connect-src`: extended with the Express API + Supabase auth origins,
 *    since `default-src 'self'` would otherwise block every XHR/fetch the app
 *    makes. Origins are passed in (not read from env here) so this stays a pure
 *    function — testable without the `NEXT_PUBLIC_*` vars loaded.
 *
 * Development relaxations (`isDev`): `'unsafe-eval'` for the eval-based HMR
 * source maps, a `ws:` connect source for the HMR socket, and we omit
 * `upgrade-insecure-requests` so plain-http localhost isn't force-upgraded.
 */

export interface ContentSecurityPolicyOptions {
	/** Per-request nonce, already base64-encoded. */
	nonce: string;
	/**
	 * Additional origins to allow in `connect-src` (the Express API and the
	 * Supabase auth endpoint). `'self'` is always included.
	 */
	connectOrigins: string[];
	/** When true, apply dev-only relaxations for HMR + the error overlay. */
	isDev: boolean;
}

export function buildContentSecurityPolicy({ nonce, connectOrigins, isDev }: ContentSecurityPolicyOptions): string {
	const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
	if (isDev) {
		// HMR + react-refresh evaluate code via eval-source-map in development.
		scriptSrc.push("'unsafe-eval'");
	}

	const connectSrc = ["'self'", ...connectOrigins];
	if (isDev) {
		// Next's dev HMR socket connects over ws:// on the same host; `'self'`
		// does not cover the ws scheme, so it must be named explicitly.
		connectSrc.push("ws://localhost:*");
	}

	const directives = [
		`default-src 'self'`,
		`script-src ${scriptSrc.join(" ")}`,
		`style-src 'self' 'unsafe-inline'`,
		`img-src 'self' blob: data:`,
		`font-src 'self'`,
		`connect-src ${connectSrc.join(" ")}`,
		`object-src 'none'`,
		`base-uri 'self'`,
		`form-action 'self'`,
		`frame-ancestors 'none'`,
	];
	if (!isDev) {
		// Only in production: localhost dev runs over plain http, where this
		// directive would break every same-origin request by upgrading it.
		directives.push("upgrade-insecure-requests");
	}

	return directives.join("; ");
}
