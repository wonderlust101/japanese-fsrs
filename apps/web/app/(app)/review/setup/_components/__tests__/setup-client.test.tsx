import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listDecksAction } from "@/lib/actions/decks.actions";

import { getDueCardsAction } from "@/lib/actions/reviews.actions";

import { makeDeck, makeDueCard } from "@/test/factories";

import { renderWithProviders, screen } from "@/test/test-utils";

import { SetupClient } from "../setup-client";

// Characterization test (added 2026-05-30 ahead of the orchestrator → hooks
// refactor). Pins the four render branches the SetupClient resolves from the
// due-cards + decks queries: first-time, caught-up, default, and cold-boot
// error. Behavior must survive the extraction of use-setup-* hooks unchanged.

// Synchronous-storage shim BEFORE any store/persist module loads (the tuning
// stores use Zustand persist, which captures the storage ref at import time).
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

vi.mock("@/lib/actions/reviews.actions", () => ({
	getDueCardsAction: vi.fn(),
	submitReviewAction: vi.fn(),
	getSessionSummaryAction: vi.fn(),
	batchDiagnoseSessionWeakSpotsAction: vi.fn(),
	submitBatchAction: vi.fn(),
	rollbackReviewAction: vi.fn(),
	getRatingsPreviewAction: vi.fn(),
	getReviewForecastAction: vi.fn(),
}));

vi.mock("@/lib/actions/decks.actions", () => ({
	listDecksAction: vi.fn(),
	listDecksWithStatsAction: vi.fn(),
	listDecksStrictAction: vi.fn(),
	getDeckAction: vi.fn(),
	getDeckWithStatsAction: vi.fn(),
	createDeckAction: vi.fn(),
	deleteDeckAction: vi.fn(),
	updateDeckAction: vi.fn(),
	copyDeckAction: vi.fn(),
	archiveDeckAction: vi.fn(),
	unarchiveDeckAction: vi.fn(),
}));

const mockedDue = vi.mocked(getDueCardsAction);
const mockedDecks = vi.mocked(listDecksAction);

const EMPTY_LIST = { items: [], nextCursor: null, hasMore: false };

beforeEach(() => {
	if (typeof window !== "undefined")
		window.localStorage.clear();
});

afterEach(() => {
	mockedDue.mockReset();
	mockedDecks.mockReset();
});

function renderSetup(): ReturnType<typeof renderWithProviders> {
	return renderWithProviders(
		<SetupClient initialTodayKey="2026-05-30" initialTimeZone="UTC" />,
	);
}

describe("setupClient", () => {
	it("renders the first-time state when the library is empty", async () => {
		mockedDecks.mockResolvedValue({ ...EMPTY_LIST });
		mockedDue.mockResolvedValue({ ...EMPTY_LIST });

		renderSetup();

		// FirstTimeState leads with the Japanese kicker 始めましょう.
		expect(await screen.findByText("始めましょう。")).toBeInTheDocument();
	});

	it("renders the caught-up state when decks exist but nothing is due", async () => {
		mockedDecks.mockResolvedValue({ items: [makeDeck({ id: "deck-1" })], nextCursor: null, hasMore: false });
		mockedDue.mockResolvedValue({ ...EMPTY_LIST });

		renderSetup();

		expect(await screen.findByText(/nothing scheduled/i)).toBeInTheDocument();
	});

	it("renders the tuning surface when cards are due", async () => {
		mockedDecks.mockResolvedValue({ items: [makeDeck({ id: "deck-1" })], nextCursor: null, hasMore: false });
		mockedDue.mockResolvedValue({
			items: [makeDueCard({ id: "card-1", deckId: "deck-1" })],
			nextCursor: null,
			hasMore: false,
		});

		renderSetup();

		expect(await screen.findByText(/tune today's session/i)).toBeInTheDocument();
	});

	it("renders a retryable error pane on a cold-boot failure", async () => {
		mockedDecks.mockResolvedValue({ ...EMPTY_LIST });
		mockedDue.mockRejectedValueOnce(new Error("offline"));

		renderSetup();

		expect(await screen.findByRole("button", { name: /refresh/i })).toBeInTheDocument();
	});
});
