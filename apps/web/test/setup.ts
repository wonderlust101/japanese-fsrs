/**
 * Vitest global setup for the web workspace.
 *
 * Responsibilities (in order of cost):
 *   1. Register `@testing-library/jest-dom` and `jest-axe` matchers.
 *   2. Stub jsdom's missing or broken browser APIs (`matchMedia`,
 *      `IntersectionObserver`, `ResizeObserver`, `HTMLDialogElement.showModal`)
 *      and provide a real in-memory `localStorage` / `sessionStorage`. Zustand's
 *      `persist` middleware captures the storage reference at module-import
 *      time, so these shims MUST run before any store file is loaded —
 *      placing them in `setupFiles` (this file) is the right place.
 *   3. Mock `next/navigation`, `next/image`, and `next/font` once so route-
 *      level components render under jsdom without pulling Next's runtime.
 *   4. Wire MSW's Node-side server lifecycle (`listen` / `resetHandlers` /
 *      `close`) so any test that hits `fetch` is intercepted by default.
 *
 * Anything that mutates global Zustand state (e.g. `useReviewSessionStore`)
 * resets *inside the relevant test file* rather than here — global resets
 * obscure which store a failure originated in.
 */

import { toHaveNoViolations } from "jest-axe";

import React from "react";
import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";

import { server } from "./msw/server";

import "@testing-library/jest-dom/vitest";

// jest-axe matcher. Registered globally so any test can call
// `expect(container).toHaveNoViolations()` (or use the
// `expectNoA11yViolations` helper from `./axe`).
expect.extend(toHaveNoViolations);

// ── jsdom shims ───────────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
	// matchMedia. Default to "no preference" so reduced-motion checks don't
	// over-trigger; tests can override per-suite.
	if (!window.matchMedia) {
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: (query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(), // legacy API; some libraries still use it
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(() => true),
			}),
		});
	}

	// IntersectionObserver — jsdom does not implement layout, so it's not real
	// observation; the no-op shim just prevents `new IntersectionObserver(...)`
	// from throwing.
	if (!("IntersectionObserver" in window)) {
		class MockIntersectionObserver {
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
			takeRecords = vi.fn(() => []);
		}
		Object.defineProperty(window, "IntersectionObserver", {
			writable: true,
			value: MockIntersectionObserver,
		});
	}

	if (!("ResizeObserver" in window)) {
		class MockResizeObserver {
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
		}
		Object.defineProperty(window, "ResizeObserver", {
			writable: true,
			value: MockResizeObserver,
		});
	}

	// HTMLDialogElement.showModal / .close are unimplemented in jsdom. The
	// `Dialog` primitive relies on them, so tests that exercise modals would
	// throw without these. Each one toggles the `open` attribute so RTL queries
	// like `screen.getByRole("dialog")` work as expected.
	const dialogProto = (globalThis as { HTMLDialogElement?: { prototype: HTMLDialogElement } }).HTMLDialogElement?.prototype;
	if (dialogProto && typeof dialogProto.showModal !== "function") {
		dialogProto.showModal = function showModal(this: HTMLDialogElement): void {
			this.setAttribute("open", "");
		};
	}
	if (dialogProto && typeof dialogProto.close !== "function") {
		dialogProto.close = function close(this: HTMLDialogElement): void {
			this.removeAttribute("open");
		};
	}

	// localStorage / sessionStorage — Zustand's `persist` middleware captures
	// these at store-module import time, so the shim has to be in place before
	// any test file's top-level imports run. jsdom 29's implementation can be
	// brittle under Node 22+; installing a deterministic in-memory store avoids
	// "localStorage is not available" warnings and per-file flakiness.
	class MemoryStorage implements Storage {
		private store = new Map<string, string>();

		get length(): number {
			return this.store.size;
		}

		clear(): void {
			this.store.clear();
		}

		getItem(key: string): string | null {
			return this.store.get(key) ?? null;
		}

		key(index: number): string | null {
			return Array.from(this.store.keys())[index] ?? null;
		}

		removeItem(key: string): void {
			this.store.delete(key);
		}

		setItem(key: string, value: string): void {
			this.store.set(key, String(value));
		}
	}

	// Force-override unconditionally — even if jsdom provides storage, the
	// `MemoryStorage` instance is more predictable across reset semantics.
	//
	// CRUCIALLY: pin the SAME `MemoryStorage` instance on both `window` AND
	// `globalThis`. Source code that writes `localStorage.getItem(...)` without
	// the `window.` prefix resolves through `globalThis` lookup, which on
	// Node 22+ can pick up Node's own experimental localStorage shim — NOT
	// jsdom's. Two separate storage instances → `setItem` succeeds but
	// `removeItem` / `getItem` see the other one. We pin one instance to
	// both so the two paths reach the same Map.
	const localStorageInstance = new MemoryStorage();
	const sessionStorageInstance = new MemoryStorage();
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		writable: true,
		value: localStorageInstance,
	});
	Object.defineProperty(window, "sessionStorage", {
		configurable: true,
		writable: true,
		value: sessionStorageInstance,
	});
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		writable: true,
		value: localStorageInstance,
	});
	Object.defineProperty(globalThis, "sessionStorage", {
		configurable: true,
		writable: true,
		value: sessionStorageInstance,
	});
}

// ── next/navigation default mock ──────────────────────────────────────────────
//
// Tests that need a specific router behavior override via:
//   import { useRouter } from "next/navigation";
//   vi.mocked(useRouter).mockReturnValue({ push: spy, ... });

vi.mock("next/navigation", () => {
	const noop = (): void => {};
	return {
		useRouter: vi.fn(() => ({
			push: vi.fn(noop),
			replace: vi.fn(noop),
			refresh: vi.fn(noop),
			back: vi.fn(noop),
			forward: vi.fn(noop),
			prefetch: vi.fn(noop),
		})),
		usePathname: vi.fn(() => "/"),
		useSearchParams: vi.fn(() => new URLSearchParams()),
		useParams: vi.fn(() => ({})),
		redirect: vi.fn(noop),
		notFound: vi.fn(noop),
	};
});

// `next/image` rendering pulls Next's image-optimization pipeline. Under jsdom
// we return a real React `<img>` element so it composes correctly into parent
// trees (React 19 rejects DOM nodes as children). `priority`, `fill`, `loader`,
// and other Next-specific props are stripped because passing them straight
// through would produce DOM warnings about unknown props.
vi.mock("next/image", () => ({
	default: (props: Record<string, unknown>) => {
		const {
			priority: _priority,
			fill: _fill,
			loader: _loader,
			placeholder: _placeholder,
			blurDataURL: _blurDataURL,
			quality: _quality,
			unoptimized: _unoptimized,
			...rest
		} = props;
		return React.createElement("img", { ...rest, alt: (rest as { alt?: string }).alt ?? "" });
	},
}));

// `next/font` likewise — return a stub whose surface matches enough of the
// loader return value that components don't blow up at import time. Each font
// helper (`Inter`, `Noto_Sans_JP`, etc.) is invoked at module scope.
function fontStub(): { className: string; style: { fontFamily: string }; variable: string } {
	return {
		className: "mock-font",
		style: { fontFamily: "mock" },
		variable: "--mock-font",
	};
}

vi.mock("next/font/google", () => new Proxy({}, {
	get: () => fontStub,
}));

vi.mock("next/font/local", () => ({
	default: fontStub,
}));

// ── MSW lifecycle ─────────────────────────────────────────────────────────────
//
// `onUnhandledRequest: "error"` is intentional — it surfaces missing handlers
// loudly during test authoring instead of silently letting requests fall
// through to the real network.

beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
	server.resetHandlers();
	// Reset every in-memory storage between tests so persisted store state
	// from one test doesn't bleed into another's import-time read.
	if (typeof window !== "undefined") {
		window.localStorage.clear();
		window.sessionStorage.clear();
	}
});

afterAll(() => {
	server.close();
});
