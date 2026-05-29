/**
 * Premade catalogue → user library copy flow.
 *
 * Runs in `chromium-authenticated` against the seeded fixture user. The seed
 * CLI has already copied one premade deck into the fixture's library, so this
 * spec exercises the "add another" path (still uses the same backend route,
 * `POST /api/v1/premade-decks/:id/copy`, which by design allows duplicate
 * copies — see premade.service.ts `copyPremadeDeck`).
 *
 * The catalogue's primary affordance is the "Add to my library" button
 * (confirmed against `decks/premade/_components/premade-catalogue.tsx`,
 * `CatalogueCard.action`). After a successful copy the page surfaces a Toast
 * with the count + deck name; we anchor on the Toast appearing rather than on
 * the exact copy so a microcopy tweak doesn't break the contract.
 *
 * Post-copy the spec navigates to /decks and asserts a deck card carrying
 * the same deck name appears in the user's library list. The seed leaves one
 * copy already in place, so the assertion is "at least one" — duplicates are
 * a valid product state under the copy model.
 */
import { expect, test } from "@playwright/test";

test.describe("decks: add a premade deck to library", () => {
	test("copies a premade deck and surfaces it on /decks", async ({ page }) => {
		await page.goto("/decks/premade");

		// The catalogue is a TanStack Query view — wait for the first card's
		// header to land before driving any action so we don't race the
		// loader.
		const firstCard = page.getByRole("heading", { level: 2 }).first();
		await expect(firstCard).toBeVisible();
		const deckName = (await firstCard.textContent())?.trim() ?? "";
		expect(deckName.length).toBeGreaterThan(0);

		// `getByRole('button', { name: /add ... to my library/i })` matches both
		// "Add <Deck Name> to my library" (CatalogueCard aria-label) and "Add
		// another copy of <Deck Name> to my library" (when the seed already
		// landed a copy of this deck). Either path is acceptable.
		const addButton = page
			.getByRole("button", { name: new RegExp(`add.+${escapeRegex(deckName)}.+library`, "i") })
			.first();
		// Some deck cards render a QuietLink "Add another copy" — link, not
		// button — when the user has already copied that deck. Fall back to
		// the link role if no matching button exists.
		const addLink = page
			.getByRole("link", { name: new RegExp(`add another copy.+${escapeRegex(deckName)}`, "i") })
			.first();

		const addButtonVisible = await addButton.isVisible().catch(() => false);
		if (addButtonVisible) {
			await addButton.click();
		} else {
			await expect(addLink).toBeVisible();
			await addLink.click();
		}

		// Success affordance: the catalogue calls showToast() with copy like
		// "Added N cards from <deck> to your library." The Toast renders as
		// role="status" (see components/ui/Toast.tsx). Be tolerant of the
		// exact word — "Added" / "added" / "added another" all qualify.
		await expect(page.getByRole("status").filter({ hasText: /added/i }).first()).toBeVisible({ timeout: 10_000 });

		// Verify the deck reaches the library. The Decks page renders each
		// deck name as a role="heading"; we filter to the seeded name.
		await page.goto("/decks");
		await expect(page.getByRole("heading", { name: new RegExp(escapeRegex(deckName), "i") }).first()).toBeVisible({
			timeout: 10_000,
		});
	});
});

/**
 * Tiny regex-escape so a deck name carrying characters like `(`, `)`, `.`,
 * etc. doesn't blow up the dynamic name matcher. Pulled inline to keep the
 * spec free of test-utility imports.
 */
function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
