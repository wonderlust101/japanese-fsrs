import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for `@fsrs-japanese/web`.
 *
 * First-wave scope: Chromium only. Firefox/WebKit can be added once the suite
 * is large enough to justify the CI minute cost.
 *
 * The `webServer` block uses a dedicated port (3100) in CI to dodge the
 * `apps/web/.next` collision documented in the memory note
 * `web-dev-server-build-collision` — running `next dev` against a `.next`
 * directory that another process is currently writing produces 500s. In CI
 * each Playwright run owns its own port and `.next` is fresh from `actions/cache`.
 *
 * Reference: <https://playwright.dev/docs/test-configuration>.
 */
const PORT = process.env.CI ? 3100 : 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./e2e",
	// Suite-wide timeout per test. Auth flows can be slow on a cold Supabase
	// container; 30s is generous but not pathological.
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// Disabled retries on the review-session spec (it mutates FSRS state and a
	// half-passed run leaves seeded cards in an advanced state). Other specs may
	// opt into retries via `test.describe.configure({ retries: 1 })`.
	retries: 0,
	// Omit `workers` outside CI so Playwright picks its own default (half cores);
	// `exactOptionalPropertyTypes: true` forbids passing `undefined`.
	...(process.env.CI ? { workers: 1 } : {}),
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
		// Deterministic locale + timezone — `buildDashboardCalendarContext`
		// derives "today" from these and the review-session E2E asserts on day-
		// boundary state, so anchoring removes a class of flakes.
		locale: "en-US",
		timezoneId: "America/Los_Angeles",
		colorScheme: "light",
	},
	projects: [
		// 1. Setup project: signs the seeded fixture user in once and writes
		//    `storageState` to disk. `chromium-authenticated` consumes that
		//    artefact via the `dependencies` link below. The setup spec is
		//    matched by filename so a stray `*.setup.ts` outside of e2e/ can't
		//    accidentally run before every test.
		{
			name: "setup",
			testMatch: /auth\.setup\.ts$/,
			use: { ...devices["Desktop Chrome"] },
		},
		// 2. Unauthenticated suite — smoke + middleware gating + login form.
		//    These specs deliberately drive the public-facing entry points
		//    with no cookie jar pre-loaded, so we ignore the authenticated
		//    specs *and* the setup spec.
		{
			name: "chromium",
			testIgnore: [
				/auth\.setup\.ts$/,
				/auth\.logout\.spec\.ts$/,
				/decks\.premade-add\.spec\.ts$/,
				/review\.session\.spec\.ts$/,
			],
			use: { ...devices["Desktop Chrome"] },
		},
		// 3. Authenticated suite — runs every spec that needs a signed-in
		//    session. Depends on `setup` so the storageState file is written
		//    before any test in this project starts. Auth-flow specs that
		//    drive sign-in themselves stay in the unauthenticated project
		//    above; this one only matches specs that *start* authenticated.
		{
			name: "chromium-authenticated",
			dependencies: ["setup"],
			testMatch: [
				/auth\.logout\.spec\.ts$/,
				/decks\.premade-add\.spec\.ts$/,
				/review\.session\.spec\.ts$/,
			],
			use: {
				...devices["Desktop Chrome"],
				storageState: "e2e/.auth/user.json",
			},
		},
	],
	// `bun dev` over `next dev` because the dev server is what's wired against
	// the workspace; `next start` requires `next build` first and would collide
	// with any background dev server (see `web-dev-server-build-collision`).
	webServer: {
		command: `bun run dev --port ${PORT}`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "ignore",
		stderr: "pipe",
	},
});
