/**
 * Sign-out flow.
 *
 * Runs in `chromium-authenticated`, so the spec arrives at /today already
 * signed in (storageState pre-loaded from `e2e/.auth/user.json`). The test
 * exercises:
 *   1. Opening the account menu in the sidebar (role="button"/"Account menu").
 *   2. Activating the "Sign out" menuitem.
 *   3. Verifying the post-logout redirect to /login.
 *   4. Confirming that the session cookie was actually cleared server-side
 *      by hitting a protected route — the middleware redirect proves the
 *      logout was honoured, not just a client-side route push.
 *
 * The menu is rendered by `apps/web/app/(app)/_components/user-menu.tsx`,
 * which is mounted from both the sidebar and the mobile drawer; on Desktop
 * Chrome's default viewport the sidebar copy is the one we drive.
 */
import { expect, test } from "@playwright/test";

test.describe("auth: sign out", () => {
	test("signs out from the account menu and clears server session", async ({ page }) => {
		await page.goto("/today");
		// Sanity: arriving here as signed-in means the chrome rendered.
		await expect(page).toHaveURL(/\/today/);

		// `getByRole('button', { name: /account menu/i }).first()` accommodates
		// the dual mount (sidebar + mobile drawer) without coupling to either.
		// On Desktop Chrome the sidebar copy is the one that sits in the
		// always-visible part of the DOM.
		const accountMenuTrigger = page.getByRole("button", { name: /account menu/i }).first();
		await expect(accountMenuTrigger).toBeVisible();
		await accountMenuTrigger.click();

		// The menu items render with role="menuitem". "Sign out" is the
		// danger-toned terminal item in the popover (see user-menu.tsx).
		const signOutItem = page.getByRole("menuitem", { name: /sign out/i });
		await expect(signOutItem).toBeVisible();
		await signOutItem.click();

		// Post-logout the user-menu code pushes to /login. We accept either
		// /login or / since the redirect target has shifted before; the
		// invariant is "not /today".
		await expect(page).toHaveURL(/\/(login|$)/);

		// Server-side verification: revisit a protected route. If the cookies
		// were really cleared, middleware redirects us back to /login with
		// the original path as `next`. If only the client-side push happened
		// (session still live), middleware would let /today through and we'd
		// detect the regression here.
		await page.goto("/today");
		await expect(page).toHaveURL(/\/login\?next=%2Ftoday/);
	});
});
