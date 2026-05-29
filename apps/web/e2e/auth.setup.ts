/**
 * Playwright auth setup — signs the seeded fixture user in once and persists
 * `storageState` to `e2e/.auth/user.json`. Every spec that runs in the
 * `chromium-authenticated` project depends on this file and reuses the
 * resulting cookie jar, so the per-spec cost of "log in first" is paid once
 * per test run rather than per-test.
 *
 * Prerequisites:
 *   - The API has been seeded with the fixture user via
 *     `bun --filter @fsrs-japanese/api run seed:e2e`. The seed CLI prints the
 *     credentials it created; this setup reads them from the matching env
 *     vars (with hard-coded defaults that mirror the seed script).
 *   - Supabase is reachable from the dev server `bun run dev` boots.
 *
 * Reference: https://playwright.dev/docs/auth#authenticate-with-a-setup-project
 */
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test as setup } from "@playwright/test";

// Defaults intentionally mirror the seed script (`apps/api/scripts/seed-e2e-user.ts`)
// so a vanilla local run works without any env wiring. CI can override either.
const EMAIL = process.env.E2E_USER_EMAIL ?? "e2e-fixture@tomo.test";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-fixture-password-1";

// `import.meta.dirname` resolves under Bun + Playwright's transpile path; the
// auth artefact lives alongside the spec dir so the .gitignore entry catches it.
const STORAGE_STATE = "e2e/.auth/user.json";

setup("authenticate seeded fixture user", async ({ page }) => {
	// Ensure the destination directory exists before storageState is written —
	// Playwright's saveAs throws if the parent dir is missing on the first run.
	await mkdir(dirname(STORAGE_STATE), { recursive: true });

	await page.goto("/login");

	// Real form, real auth round-trip. We use getByLabel so the spec stays
	// stable across visual tweaks; the underlying `<Input label="Email">`
	// component wires `htmlFor` / `id` automatically.
	await page.getByLabel("Email").fill(EMAIL);
	await page.getByLabel("Password").fill(PASSWORD);
	await page.getByRole("button", { name: /sign in/i }).click();

	// Middleware redirects to /today on successful login. Auto-retrying
	// expect keeps this stable without a polling sleep.
	await expect(page).toHaveURL(/\/today/);

	await page.context().storageState({ path: STORAGE_STATE });
});
