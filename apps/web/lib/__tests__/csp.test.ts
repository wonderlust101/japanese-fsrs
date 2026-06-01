import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/csp";

const ORIGINS = ["http://localhost:3001", "https://proj.supabase.co"];

/** Parse a CSP string into a directive → sources map for order-independent asserts. */
function parse(csp: string): Record<string, string[]> {
	return Object.fromEntries(
		csp.split(";").map(d => d.trim()).filter(Boolean).map((directive) => {
			const [name, ...sources] = directive.split(/\s+/);
			return [name, sources] as const;
		}),
	);
}

describe("buildContentSecurityPolicy", () => {
	it("embeds the nonce and strict-dynamic in script-src", () => {
		const directives = parse(buildContentSecurityPolicy({ nonce: "abc123", connectOrigins: ORIGINS, isDev: false }));
		expect(directives["script-src"]).toContain("'self'");
		expect(directives["script-src"]).toContain("'nonce-abc123'");
		expect(directives["script-src"]).toContain("'strict-dynamic'");
	});

	it("allows the supplied connect origins plus 'self'", () => {
		const directives = parse(buildContentSecurityPolicy({ nonce: "n", connectOrigins: ORIGINS, isDev: false }));
		expect(directives["connect-src"]).toEqual(expect.arrayContaining(["'self'", ...ORIGINS]));
	});

	it("locks down the static anti-injection directives", () => {
		const directives = parse(buildContentSecurityPolicy({ nonce: "n", connectOrigins: ORIGINS, isDev: false }));
		expect(directives["object-src"]).toEqual(["'none'"]);
		expect(directives["base-uri"]).toEqual(["'self'"]);
		expect(directives["form-action"]).toEqual(["'self'"]);
		expect(directives["frame-ancestors"]).toEqual(["'none'"]);
		// style-src must keep unsafe-inline (React inline styles can't be nonced).
		expect(directives["style-src"]).toContain("'unsafe-inline'");
	});

	describe("production", () => {
		const csp = buildContentSecurityPolicy({ nonce: "n", connectOrigins: ORIGINS, isDev: false });
		const directives = parse(csp);

		it("adds upgrade-insecure-requests", () => {
			expect(csp).toContain("upgrade-insecure-requests");
		});

		it("does not allow unsafe-eval or ws: connections", () => {
			expect(directives["script-src"]).not.toContain("'unsafe-eval'");
			expect(directives["connect-src"]).not.toContain("ws://localhost:*");
		});
	});

	describe("development", () => {
		const csp = buildContentSecurityPolicy({ nonce: "n", connectOrigins: ORIGINS, isDev: true });
		const directives = parse(csp);

		it("relaxes script-src with unsafe-eval and connect-src with ws: for HMR", () => {
			expect(directives["script-src"]).toContain("'unsafe-eval'");
			expect(directives["connect-src"]).toContain("ws://localhost:*");
		});

		it("omits upgrade-insecure-requests so localhost http is not force-upgraded", () => {
			expect(csp).not.toContain("upgrade-insecure-requests");
		});
	});
});
