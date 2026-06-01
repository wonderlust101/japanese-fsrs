import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listDecksAction } from "@/lib/actions/decks.actions";

import { getProfileAction } from "@/lib/actions/profile.actions";

import { getDueCardsAction } from "@/lib/actions/reviews.actions";
import { useReviewSessionStore } from "@/stores/useReviewSessionStore";
import { useSessionDevOverridesStore } from "@/stores/useSessionDevOverridesStore";

import { makeProfile } from "@/test/factories";
import { renderWithProviders, screen } from "@/test/test-utils";
import ReviewSessionPage from "../page";

// Install a synchronous-storage shim BEFORE any store/persist module loads.
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

vi.mock("@/lib/env", () => ({
	env: {
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
		NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
		NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test",
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
	},
}));

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

vi.mock("@/lib/actions/profile.actions", () => ({
	getProfileAction: vi.fn(),
}));

vi.mock("@/lib/actions/decks.actions", () => ({
	getDeckAction: vi.fn(),
	getDeckWithStatsAction: vi.fn(),
	listDecksAction: vi.fn(),
	listDecksWithStatsAction: vi.fn(),
	listDecksStrictAction: vi.fn(),
	createDeckAction: vi.fn(),
	deleteDeckAction: vi.fn(),
	updateDeckAction: vi.fn(),
	copyDeckAction: vi.fn(),
	archiveDeckAction: vi.fn(),
	unarchiveDeckAction: vi.fn(),
}));

vi.mock("@/lib/actions/reviews.actions", () => ({
	getDueCardsAction: vi.fn(),
	submitReviewAction: vi.fn(),
	getSessionSummaryAction: vi.fn(),
	getRatingsPreviewAction: vi.fn(),
	getReviewForecastAction: vi.fn(),
	rollbackReviewAction: vi.fn(),
	batchDiagnoseSessionWeakSpotsAction: vi.fn(),
	closeSessionAction: vi.fn(),
	submitBatchAction: vi.fn(),
}));

vi.mock("@/lib/api/reviews", async () => {
	const actual = await vi.importActual<typeof import("@/lib/api/reviews")>("@/lib/api/reviews");
	return {
		...actual,
		// The page subscribes to a background sync hook; the tests don't need
		// it to do anything, so collapse it to a no-op so we don't have to
		// stub its underlying queue infrastructure.
		useOfflineSync: vi.fn(),
	};
});

const mockedProfile = vi.mocked(getProfileAction);
const mockedListDecks = vi.mocked(listDecksAction);
const mockedDue = vi.mocked(getDueCardsAction);

beforeEach(() => {
	mockedProfile.mockResolvedValue(makeProfile());
	mockedListDecks.mockResolvedValue({
		items: [],
		nextCursor: null,
		hasMore: false,
	});
	mockedDue.mockResolvedValue({
		items: [],
		nextCursor: null,
		hasMore: false,
	});
});

afterEach(() => {
	// Reset zustand stores between tests
	useReviewSessionStore.getState().actions.reset();
	useSessionDevOverridesStore.getState().actions.reset();
	mockedProfile.mockReset();
	mockedListDecks.mockReset();
	mockedDue.mockReset();
});

describe("reviewSessionPage", () => {
	describe("bootstrap-failed state", () => {
		it("renders the 'Couldn't load' state card when the dev override is on", async () => {
			useSessionDevOverridesStore.getState().actions.set("forceBootstrapFailed", true);

			renderWithProviders(<ReviewSessionPage />);

			expect(
				await screen.findByRole("heading", { name: /something interrupted the session/i }),
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /back to setup/i })).toBeInTheDocument();
		});
	});

	describe("loading state", () => {
		it("renders the 'Preparing your reviews' loader during bootstrap", () => {
			useSessionDevOverridesStore.getState().actions.set("forceBootstrapping", true);

			renderWithProviders(<ReviewSessionPage />);

			expect(screen.getByText(/preparing your reviews/i)).toBeInTheDocument();
		});
	});

	describe("ending-session state", () => {
		it("renders the 'Wrapping up' loader when forceEndingSession is on (after bootstrap resolves)", async () => {
			useSessionDevOverridesStore.getState().actions.set("forceEndingSession", true);

			renderWithProviders(<ReviewSessionPage />);

			// `isBootstrapping` wins over `isEndingSession` if the profile or
			// the due query haven't resolved yet. With the action mock returning
			// a complete profile, the bootstrap settles to ready and the ending-
			// session branch becomes visible. findBy* polls until that's true.
			expect(await screen.findByText(/wrapping up/i)).toBeInTheDocument();
		});
	});
});
