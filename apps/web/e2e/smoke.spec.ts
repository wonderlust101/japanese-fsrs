import { expect, test } from "@playwright/test";

/**
 * Smoke test — proves the app boots and renders without panicking.
 *
 * Anonymous visitors hit `/` and see the marketing landing. That is the
 * single most important public-facing contract — if this test fails, the
 * site is down.
 *
 * No auth, no API mutation. Stays green even when Supabase is unreachable
 * as long as the page itself can render its server component shell.
 */
test.describe("smoke", () => {
	test("anonymous visitor reaches the marketing landing at /", async ({ page }) => {
		// Capture console errors so a clean-looking render that's actually
		// throwing on the client doesn't pass silently.
		const consoleErrors: string[] = [];
		page.on("pageerror", (err) => {
			consoleErrors.push(err.message);
		});

		await page.goto("/");

		// The landing must end at `/`, not redirect to /login or /today. (Auth'd
		// users redirect to /today via middleware; anon users stay.)
		await expect(page).toHaveURL(/\/$/);

		// At least one role="heading" should be present. We don't pin exact copy
		// because the landing is creative-led and changes; we pin the *fact*
		// that some H1-equivalent is rendered.
		const headings = page.getByRole("heading");
		await expect(headings.first()).toBeVisible();

		// Any link or button — proves interactive elements rendered, not just the
		// HTML skeleton.
		const interactive = page.getByRole("link").or(page.getByRole("button"));
		await expect(interactive.first()).toBeVisible();

		expect(consoleErrors, "page emitted unhandled errors").toEqual([]);
	});
});
