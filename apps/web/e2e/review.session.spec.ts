/**
 * Review session: reveal-rate-loop until summary.
 *
 * The seeded fixture user has at least 3 cards with `due = yesterday`, so the
 * Today hero renders the "Due" variant and the primary CTA is "Start reviews"
 * (verified against `today-hero-content.tsx:124`). The flow drives:
 *   1. Today hero → "Start reviews" → /review/session.
 *   2. For each card: wait for the reveal bar (role="group", "Reveal answer"),
 *      click it, then wait for the rating bar (role="group", "Rate this card")
 *      and click the "Good" rating.
 *   3. Loop until the rating bar disappears — that signals the queue has
 *      drained and the session is wrapping up.
 *   4. Assert the post-session navigation to /review/summary.
 *
 * Retries are explicitly disabled for this spec: each successful rating
 * mutates FSRS state on the server, so a half-passed run leaves the seeded
 * cards in an advanced state that breaks deterministic re-runs without a
 * fresh seed. The full-suite seed CLI re-runs reset between Playwright
 * invocations, so a single attempt per invocation is correct.
 *
 * The 3-second undo-window (UNDO_WINDOW_MS in session/page.tsx) is *not*
 * polled with a sleep — we anchor on UI conditions (rating bar present, then
 * gone) instead, so the spec stays robust to any future tweak of that
 * window.
 */
import { expect, test } from "@playwright/test";

// FSRS mutation = no retries. See top-of-file note.
test.describe.configure({ retries: 0 });

test.describe("review: full session drain", () => {
	test("drains the seeded queue and lands on the summary", async ({ page }) => {
		await page.goto("/today");

		// The Today hero CTA is `<Link href="/review/session">Start reviews</Link>`.
		// On Desktop Chrome at default viewport (1280×720) the inline copy
		// renders at lg+, so we can drive that link directly. We accept either
		// the inline or sticky-mobile rendering by querying by accessible name.
		await page.getByRole("link", { name: /start reviews/i }).first().click();

		await expect(page).toHaveURL(/\/review\/(session|setup)/);

		// If the dev environment routes through /setup (no queued cards in the
		// fixture timezone, say), bail out loudly — the seed contract is that
		// the fixture user *always* has due cards.
		expect(new URL(page.url()).pathname).toBe("/review/session");

		// Drain the queue. The reveal bar is the front-of-card affordance
		// (RevealBar.tsx — `role="group" aria-label="Reveal answer"`). The
		// rating bar is the back-of-card grid (RatingBar.tsx — `role="group"
		// aria-label="Rate this card"`). We loop on those two states until
		// the rating bar no longer appears, indicating the queue is drained
		// and the page is transitioning to the summary.
		const revealBar = page.getByRole("group", { name: /reveal answer/i });
		const ratingBar = page.getByRole("group", { name: /rate this card/i });
		const goodButton = page.getByRole("button", { name: /^good/i });

		// Hard cap on the loop: the seed plants 3 cards, but a future
		// fixture-tuning regression could grow that count. 32 keeps the spec
		// fast while leaving headroom; if we hit it the failure is loud.
		const MAX_RATINGS = 32;
		let ratingsApplied = 0;

		// We can't use a single `for` loop because each iteration needs the
		// reveal bar to land *before* the click. The inner `expect` is the
		// auto-retrying wait; no sleeps.
		for (let i = 0; i < MAX_RATINGS; i += 1) {
			// First card lands quickly; subsequent cards may take a beat as
			// the deferred submit fires. The default 5s expect timeout is
			// plenty.
			const revealVisible = await revealBar.isVisible().catch(() => false);
			if (!revealVisible) {
				// If reveal bar isn't visible, either the queue has fully
				// drained (we'd be navigating to summary) or we're between
				// cards. Check for the post-session URL transition before
				// declaring done.
				const onSummary = /\/review\/summary/.test(page.url());
				if (onSummary)
					break;
				// Otherwise wait for the reveal bar — auto-retrying expect
				// covers the inter-card gap without sleeping.
				await expect(revealBar).toBeVisible();
			}

			await revealBar.click();

			// Wait for the rating bar to land before we click Good. The
			// rating-bar's appearance is the canonical "answer revealed"
			// signal.
			await expect(ratingBar).toBeVisible();
			await goodButton.click();
			ratingsApplied += 1;

			// After clicking Good, the session.page advances the local Zustand
			// queue immediately, then defers the API submit for the 3s undo
			// window. The next reveal-or-summary state lands as soon as the
			// queue index advances; we let the next iteration's checks handle
			// the wait.
		}

		// The session must have rated at least the 3 seeded cards before
		// landing on the summary.
		expect(ratingsApplied).toBeGreaterThanOrEqual(3);

		// Wait for the navigation to summary. The session page calls
		// router.replace(`/review/summary?id=${sessionId}`) once the last
		// deferred submit settles, so we need a generous wait to cover
		// the 3s undo window plus the API round-trip.
		await expect(page).toHaveURL(/\/review\/summary/, { timeout: 15_000 });
	});
});
