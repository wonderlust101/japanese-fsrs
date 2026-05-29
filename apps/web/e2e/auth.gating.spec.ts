import { expect, test } from "@playwright/test";

/**
 * Middleware gating contract.
 *
 * The Supabase-auth middleware (`apps/web/middleware.ts`) sits in front of every
 * protected route. Logged-out users hitting one must be redirected to `/login`
 * with the original path encoded as `?next=...` so the login page can return
 * them there post-auth.
 *
 * This spec exercises the public-facing half of that contract (anonymous → /login).
 * The authenticated half (logged-in user on auth page → /today) requires a
 * seeded Supabase user and lives in `auth.login.spec.ts` (deferred to a later
 * batch once the seed helper exists).
 */
test.describe("middleware: unauthenticated gating", () => {
	test("redirects /today → /login?next=/today", async ({ page }) => {
		await page.goto("/today");
		await expect(page).toHaveURL(/\/login\?next=%2Ftoday/);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	});

	test("redirects /decks → /login?next=/decks", async ({ page }) => {
		await page.goto("/decks");
		await expect(page).toHaveURL(/\/login\?next=%2Fdecks/);
	});

	test("redirects /insights → /login?next=/insights", async ({ page }) => {
		await page.goto("/insights");
		await expect(page).toHaveURL(/\/login\?next=%2Finsights/);
	});

	test("redirects /settings/profile → /login?next=/settings/profile", async ({ page }) => {
		await page.goto("/settings/profile");
		// Path encoded; `/` becomes `%2F`.
		await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fprofile/);
	});

	test("redirects /weak-spots → /login?next=/weak-spots", async ({ page }) => {
		// Regression guard: the weak-spots routes were once outside the matcher,
		// leaving them ungated. The middleware fix is now codified here.
		await page.goto("/weak-spots");
		await expect(page).toHaveURL(/\/login\?next=%2Fweak-spots/);
	});
});

test.describe("middleware: public routes stay reachable", () => {
	test("/ stays at / for anonymous visitors", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveURL(/\/$/);
	});

	test("/login is reachable", async ({ page }) => {
		await page.goto("/login");
		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	});

	test("/signup is reachable", async ({ page }) => {
		await page.goto("/signup");
		await expect(page).toHaveURL(/\/signup/);
	});

	test("/forgot-password is reachable", async ({ page }) => {
		await page.goto("/forgot-password");
		await expect(page).toHaveURL(/\/forgot-password/);
	});
});
