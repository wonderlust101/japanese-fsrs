/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Vitest config for `@fsrs-japanese/web`.
 *
 * Scope: unit + component tests (React Testing Library inside jsdom). Playwright
 * specs live under `e2e/` and use their own runner, so we exclude them here to
 * avoid Vitest trying to execute them.
 *
 * MSW is the network-mock boundary (per `docs/TESTING.md` §5: "Mock at the
 * `fetch` boundary, not inside TanStack Query hooks"). Its lifecycle is wired
 * in `test/setup.ts`.
 *
 * `vite-tsconfig-paths` re-uses the `@/*` alias from `tsconfig.json` so we
 * don't maintain a parallel `resolve.alias` block that can drift.
 */
export default defineConfig({
	plugins: [
		react(),
		tsconfigPaths(),
	],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./test/setup.ts"],
		// CSS imports in source files would otherwise blow up under jsdom; this
		// makes Vitest parse but not process them. Tests assert against semantic
		// queries (roles, labels), not class names.
		css: true,
		include: ["**/*.test.{ts,tsx}"],
		exclude: [
			"**/node_modules/**",
			"**/.next/**",
			"**/dist/**",
			"**/e2e/**", // Playwright owns this directory.
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			exclude: [
				"**/node_modules/**",
				"**/.next/**",
				"**/dist/**",
				"**/e2e/**",
				"**/test/**",
				"**/__tests__/**",
				"**/*.test.{ts,tsx}",
				"**/*.config.{ts,js,mjs}",
				"app/**/layout.tsx",
				"app/**/loading.tsx",
				"app/**/error.tsx",
				"app/**/not-found.tsx",
				"dev/**",
				"**/*.d.ts",
			],
			// Per-directory thresholds. Tightened gradually — the
			// `components/**` and global gates are deliberately permissive
			// while the suite is still ramping up; tighten as new tests land.
			// The `stores/**` and `lib/**` gates are higher because those
			// layers are pure logic and the easiest to cover.
			thresholds: {
				"lines": 50,
				"branches": 40,
				"lib/**": { lines: 70, branches: 70 },
				"stores/**": { lines: 80, branches: 70 },
				"hooks/**": { lines: 70, branches: 60 },
				"components/**": { lines: 50, branches: 40 },
			},
		},
	},
});
