/**
 * Smoke test for the jest-axe integration.
 *
 * Renders a minimal button (a single accessible element with an accessible
 * name) and asserts that axe reports no violations. The point isn't to
 * exhaustively test the helper — it's to fail loudly if the matcher
 * registration in `test/setup.ts` ever regresses or if jest-axe's typings
 * change shape under us.
 */

import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "../axe";

import { renderWithProviders } from "../test-utils";

describe("axe integration", () => {
	it("flags no violations on a labelled button", async () => {
		const { container } = renderWithProviders(
			<button type="button">Click me</button>,
		);

		await expectNoA11yViolations(container);
	});

	it("exposes `toHaveNoViolations` as an expect matcher", () => {
		// Sanity check: extend was wired in setup.ts. If the matcher isn't
		// registered, this assertion would `expect(...)`-throw on `.toHaveNoViolations`.
		expect(typeof (expect({}) as unknown as { toHaveNoViolations?: unknown }).toHaveNoViolations).toBe("function");
	});
});
