import type { ApiDueCard } from "@fsrs-japanese/shared-types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReviewSessionStore } from "@/stores/useReviewSessionStore";

import { useSessionDevOverridesStore } from "@/stores/useSessionDevOverridesStore";

import { makeDueCard } from "@/test/factories";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import { ReviewCard } from "../ReviewCard";

// Install a synchronous-storage shim BEFORE any store module loads. Zustand's
// `persist` middleware resolves the storage reference at module-import time
// and caches it, so patching window.localStorage later (in beforeEach) is too
// late. `vi.hoisted` runs before any `import` in the test file.
vi.hoisted(() => {
	class MemoryStorage {
		private store = new Map<string, string>();
		get length(): number { return this.store.size; }
		clear(): void { this.store.clear(); }
		getItem(key: string): string | null { return this.store.get(key) ?? null; }
		key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
		removeItem(key: string): void { this.store.delete(key); }
		setItem(key: string, value: string): void { this.store.set(key, String(value)); }
	}
	if (typeof globalThis !== "undefined" && typeof (globalThis as { window?: Window }).window !== "undefined") {
		const w = (globalThis as { window: Window & typeof globalThis }).window;
		Object.defineProperty(w, "localStorage", {
			configurable: true,
			writable: true,
			value: new MemoryStorage(),
		});
	}
});

// Stub the env module so the validating Zod parse at import time doesn't
// crash under Vitest (which doesn't load .env.local). The shape mirrors what
// dev expects locally.
vi.mock("@/lib/env", () => ({
	env: {
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
		NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
		NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
	},
}));

// `lib/api/client.ts` imports "server-only" at module scope, which throws on
// any client-side / jsdom import path. Stub the helper functions with no-op
// shims so transitive imports through any server-action module don't blow up.
vi.mock("@/lib/api/client", () => ({
	ApiHttpError: class ApiHttpError extends Error {
		readonly status: number;
		constructor(status: number, message: string) {
			super(message);
			this.name = "ApiHttpError";
			this.status = status;
		}
	},
	apiCall: vi.fn(),
	apiCallSafe: vi.fn(),
}));

// Server actions are server-only — mock them so the import graph resolves
// under jsdom. Their actual behavior (deck lookup, suspend) is verified
// elsewhere; here we just need the modules importable.
vi.mock("@/lib/actions/decks.actions", () => ({
	getDeckAction: vi.fn().mockResolvedValue(null),
	getDeckWithStatsAction: vi.fn().mockResolvedValue(null),
	listDecksAction: vi.fn(),
	listDecksWithStatsAction: vi.fn(),
	listDecksStrictAction: vi.fn(),
	deleteDeckAction: vi.fn(),
	createDeckAction: vi.fn(),
	updateDeckAction: vi.fn(),
	copyDeckAction: vi.fn(),
	archiveDeckAction: vi.fn(),
	unarchiveDeckAction: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────────
// Seed the session with one due card so the orchestrator has something to
// render. The factory's defaults satisfy the schemas; we override the id
// so each test's card is distinguishable in failures.
function seedSession(overrides: Partial<ApiDueCard> = {}): ApiDueCard {
	const card = makeDueCard({ id: "card-under-test", ...overrides });
	useReviewSessionStore.getState().actions.startSession([card]);
	return card;
}

beforeEach(() => {
	// Clear the storage shim installed in vi.hoisted above, then seed the
	// teach-flag so the auto-show doesn't smother every test. Tests that want
	// the auto-show clear the flag again locally.
	if (typeof window !== "undefined") {
		window.localStorage.clear();
		window.localStorage.setItem("tomo.session.hasSeenTeach", "true");
	}
});

afterEach(() => {
	// Reset zustand stores between tests
	useReviewSessionStore.getState().actions.reset();
	useSessionDevOverridesStore.getState().actions.reset();
});

describe("reviewCard", () => {
	describe("renders main content", () => {
		it("renders nothing when no card is active", () => {
			const { container } = renderWithProviders(
				<ReviewCard onEndSession={vi.fn()} />,
			);
			// `phase: 'idle'` → useCurrentCard() returns undefined → component returns null.
			expect(container.firstChild).toBeNull();
		});

		it("renders the front of the card by default", () => {
			seedSession({ fieldsData: { word: "猫", reading: "ねこ", meaning: "cat" } });
			renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			// The card's headword is the most direct signal that CardFront is
			// on. Headword + furigana ruby both emit the kanji to the DOM, so
			// getAllByText is the right query.
			expect(screen.getAllByText("猫").length).toBeGreaterThan(0);
		});

		it("renders the RevealBar before the answer is shown", () => {
			seedSession();
			renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			// RevealBar is the row of "Show answer" affordance.
			expect(screen.getByRole("button", { name: /reveal answer/i })).toBeInTheDocument();
		});

		it("renders the RatingBar once the answer is revealed", async () => {
			seedSession();
			renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);
			useReviewSessionStore.getState().actions.flipCard();

			await waitFor(() => {
				expect(screen.getByRole("group", { name: /rate this card/i })).toBeInTheDocument();
			});
		});
	});

	describe("hotkeys", () => {
		it("flips the card on Space", async () => {
			seedSession();
			const { user } = renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			await user.keyboard(" ");

			await waitFor(() => {
				expect(screen.queryByRole("button", { name: /reveal answer/i })).not.toBeInTheDocument();
			});
		});

		it("flips the card on Enter", async () => {
			seedSession();
			const { user } = renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			await user.keyboard("{Enter}");

			await waitFor(() => {
				expect(screen.queryByRole("button", { name: /reveal answer/i })).not.toBeInTheDocument();
			});
		});

		it("maps 1/2/3/4 to again/hard/good/easy ratings", async () => {
			seedSession();
			useReviewSessionStore.getState().actions.flipCard();
			const submitRating = vi.spyOn(useReviewSessionStore.getState().actions, "submitRating");

			const { user } = renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			await user.keyboard("1");
			expect(submitRating).toHaveBeenLastCalledWith("again");

			// After a rating the card advances; the store moves to the next card
			// (or undefined). Re-seed for the next assertion.
			useReviewSessionStore.getState().actions.reset();
			seedSession();
			useReviewSessionStore.getState().actions.flipCard();

			await user.keyboard("2");
			expect(submitRating).toHaveBeenLastCalledWith("hard");

			useReviewSessionStore.getState().actions.reset();
			seedSession();
			useReviewSessionStore.getState().actions.flipCard();

			await user.keyboard("3");
			expect(submitRating).toHaveBeenLastCalledWith("good");

			useReviewSessionStore.getState().actions.reset();
			seedSession();
			useReviewSessionStore.getState().actions.flipCard();

			await user.keyboard("4");
			expect(submitRating).toHaveBeenLastCalledWith("easy");
		});

		it("ignores rating hotkeys before the answer is revealed", async () => {
			seedSession();
			const { user } = renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);
			// Snapshot pre-press cursor position; ratings advance the queue, so
			// a missed press would bump currentIndex by 1+. Reading from the
			// store sidesteps the spy-accumulation problem the action-singleton
			// shape creates.
			const before = useReviewSessionStore.getState();
			const cursorBefore = before.phase === "active" ? before.currentIndex : -1;

			await user.keyboard("1");
			await user.keyboard("3");

			const after = useReviewSessionStore.getState();
			const cursorAfter = after.phase === "active" ? after.currentIndex : -1;
			expect(cursorAfter).toBe(cursorBefore);
			expect(after.phase === "active" && after.sessionHistory.length).toBe(0);
		});

		it("triggers onUndo only when canUndo is true", async () => {
			seedSession();
			const onUndo = vi.fn();
			const { user } = renderWithProviders(
				<ReviewCard onEndSession={vi.fn()} canUndo onUndo={onUndo} />,
			);

			await user.keyboard("u");
			expect(onUndo).toHaveBeenCalledTimes(1);
		});

		it("does not trigger onUndo when canUndo is false", async () => {
			seedSession();
			const onUndo = vi.fn();
			const { user } = renderWithProviders(
				<ReviewCard onEndSession={vi.fn()} canUndo={false} onUndo={onUndo} />,
			);

			await user.keyboard("u");
			expect(onUndo).not.toHaveBeenCalled();
		});

		it("ignores hotkeys when focus is in an INPUT", async () => {
			seedSession();
			const flipCard = vi.spyOn(useReviewSessionStore.getState().actions, "flipCard");

			// Render the orchestrator + a sibling input the user focuses first.
			const { user } = renderWithProviders(
				<>
					<input aria-label="distract" />
					<ReviewCard onEndSession={vi.fn()} />
				</>,
			);

			await user.click(screen.getByLabelText("distract"));
			await user.keyboard(" ");

			expect(flipCard).not.toHaveBeenCalled();
		});

		it("ignores hotkeys when focus is in a TEXTAREA", async () => {
			seedSession();
			const flipCard = vi.spyOn(useReviewSessionStore.getState().actions, "flipCard");

			const { user } = renderWithProviders(
				<>
					<textarea aria-label="distract-area" />
					<ReviewCard onEndSession={vi.fn()} />
				</>,
			);

			await user.click(screen.getByLabelText("distract-area"));
			await user.keyboard(" ");

			expect(flipCard).not.toHaveBeenCalled();
		});

		it("ignores hotkeys with a modifier (Cmd/Ctrl)", async () => {
			seedSession();
			const flipCard = vi.spyOn(useReviewSessionStore.getState().actions, "flipCard");

			const { user } = renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			await user.keyboard("{Meta>} {/Meta}");
			await user.keyboard("{Control>} {/Control}");
			expect(flipCard).not.toHaveBeenCalled();
		});
	});

	describe("teach sheet auto-show", () => {
		it("opens automatically when the localStorage flag is unset", () => {
			window.localStorage.removeItem("tomo.session.hasSeenTeach");
			seedSession();
			renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			// In auto mode the sheet uses role="presentation". The headline
			// "Rate every answer" is unique to the sheet body, so it's the
			// clearest signal that the sheet is actually open.
			expect(screen.getByText(/press anything to begin/i)).toBeInTheDocument();
		});

		it("stays closed when the flag is already set", () => {
			window.localStorage.setItem("tomo.session.hasSeenTeach", "true");
			seedSession();
			renderWithProviders(<ReviewCard onEndSession={vi.fn()} />);

			expect(screen.queryByText(/press anything to begin/i)).not.toBeInTheDocument();
		});
	});
});
