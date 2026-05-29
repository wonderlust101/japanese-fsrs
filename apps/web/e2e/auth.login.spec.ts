/**
 * Login form contract.
 *
 * Exercises the real sign-in flow against the seeded fixture user. Runs in the
 * unauthenticated `chromium` project (see `playwright.config.ts`) so the spec
 * arrives at /login with no cookie jar pre-loaded. The seed CLI
 * (`bun --filter @fsrs-japanese/api run seed:e2e`) is the prerequisite —
 * without it, the positive-path test will fail at "incorrect credentials".
 *
 * The negative-path test deliberately submits a known-bad password and asserts
 * the form-level alert. The third test guards the open-redirect mitigation
 * implemented by `safeNextPath()` in app/(auth)/login/page.tsx: a hostile
 * `?next=//evil.example` parameter must NOT be honoured, even after a
 * successful login.
 */
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL ?? "e2e-fixture@tomo.test";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-fixture-password-1";

test.describe("auth: login form", () => {
	test("happy path: signs in and lands on /today with nav visible", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Email").fill(EMAIL);
		await page.getByLabel("Password").fill(PASSWORD);
		await page.getByRole("button", { name: /sign in/i }).click();

		await expect(page).toHaveURL(/\/today/);

		// The signed-in chrome ships the account menu (rendered by both the
		// sidebar and the mobile drawer). At Desktop Chrome's default viewport
		// the sidebar is visible; the menu's accessible name is the canonical
		// hook regardless of which surface renders it.
		await expect(page.getByRole("button", { name: /account menu/i }).first()).toBeVisible();
	});

	test("rejects an invalid password and stays on /login", async ({ page }) => {
		await page.goto("/login");

		await page.getByLabel("Email").fill(EMAIL);
		await page.getByLabel("Password").fill("definitely-not-the-right-password");
		await page.getByRole("button", { name: /sign in/i }).click();

		// Form-level alert is rendered with role="alert" inside the form,
		// holding the friendly-error copy from `FRIENDLY_ERRORS` in the login
		// page module. We assert visibility rather than exact copy so a
		// future microcopy tweak doesn't break the contract.
		await expect(page.getByRole("alert")).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
	});

	test("ignores an off-site ?next= and routes to /today", async ({ page }) => {
		// `safeNextPath()` rejects protocol-relative paths like `//evil.example`
		// — the login page must fall back to /today instead of honoring the
		// crafted redirect. This guards CVE-class open-redirect issues.
		await page.goto("/login?next=//evil.example");

		await page.getByLabel("Email").fill(EMAIL);
		await page.getByLabel("Password").fill(PASSWORD);
		await page.getByRole("button", { name: /sign in/i }).click();

		// Critical: assert the final URL is /today, not //evil.example.
		await expect(page).toHaveURL(/\/today/);
		// And the hostname must be the dev server, not evil.example.
		expect(new URL(page.url()).hostname).toBe("localhost");
	});
});
