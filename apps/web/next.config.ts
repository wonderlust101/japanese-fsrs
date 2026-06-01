import type { NextConfig } from "next";

import bundleAnalyzer from "@next/bundle-analyzer";

// Wraps the Next config to emit an interactive treemap of client/server chunks
// when ANALYZE=true (`bun run --filter @fsrs-japanese/web analyze`). Disabled
// for normal builds, so it never changes production output.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
	transpilePackages: ["@fsrs-japanese/shared-types"],

	// Security headers — applied to every route. Mirrors the API's Helmet
	// config (apps/api/src/app.ts:28-33) for the HTML-response side. The full
	// Content-Security-Policy is set per-request in `middleware.ts` (it carries
	// a per-request nonce, so it can't be a static header here). These remaining
	// headers are request-independent, so they stay static and also cover
	// non-HTML responses like `/_next/static`.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					// Force HTTPS for two years incl. subdomains; eligible for preload.
					// Mirrors the API's Helmet HSTS (apps/api/src/app.ts). Browsers ignore
					// this header over plain HTTP, so it is safe to send unconditionally.
					{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
					// Clickjacking — DENY because the app is never legitimately framed.
					// Belt-and-braces with the CSP `frame-ancestors 'none'` set in
					// middleware, for browsers that ignore XFO in some contexts (Firefox).
					{ key: "X-Frame-Options", value: "DENY" },
					// Block MIME-type sniffing on every response (incl. /_next/static).
					{ key: "X-Content-Type-Options", value: "nosniff" },
					// Send full referrer same-origin; only the origin cross-origin.
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					// Disable powerful features the app doesn't use, so a future code
					// change can't silently turn them on.
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
				],
			},
		];
	},
};

export default withBundleAnalyzer(nextConfig);
