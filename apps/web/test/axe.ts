/**
 * Accessibility-violation helper that wraps `jest-axe` for Vitest.
 *
 * `jest-axe` ships its matcher (`toHaveNoViolations`) as a Jest extension. It
 * works in Vitest because Vitest re-exports `expect.extend` with the same
 * shape, but its TypeScript types target Jest. The matcher is registered in
 * `test/setup.ts`; this module provides:
 *
 *   1. `expectNoA11yViolations(container)` — the assertion every component
 *      test should use. Runs axe with the project defaults; throws if any
 *      WCAG 2.1 A/AA violations are found.
 *   2. A Vitest module-augmentation block exposing the matcher on
 *      `expect(x).toHaveNoViolations()` for tests that prefer the matcher
 *      form.
 */

import { axe } from "jest-axe";
import { expect } from "vitest";

/**
 * Asserts that the given `HTMLElement` (typically `container` from
 * `renderWithProviders`) has no axe-detected accessibility violations.
 *
 * Use this as a smoke check on any user-facing component. Failures include
 * a list of violations + nodes in the test output.
 */
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
	const results = await axe(container);
	expect(results).toHaveNoViolations();
}

// ─── Vitest matcher typing ──────────────────────────────────────────────────
//
// `@types/jest-axe` declares the matcher on `jest.Matchers`. Vitest's matcher
// interface is `vitest.Assertion`, so we add the augmentation here.

declare module "vitest" {
	interface Assertion {
		toHaveNoViolations: () => Promise<void>;
	}
	interface AsymmetricMatchersContaining {
		toHaveNoViolations: () => Promise<void>;
	}
}
