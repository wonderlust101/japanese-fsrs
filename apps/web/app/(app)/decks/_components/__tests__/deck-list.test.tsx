import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	getDeckAction,
	getDeckWithStatsAction,
	listDecksAction,
} from "@/lib/actions/decks.actions";

import { makeDeck, makeDeckWithStats } from "@/test/factories";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

import { DeckListView } from "../deck-list";

// Install a synchronous-storage shim BEFORE any store/persist module loads.
// Zustand's `persist` middleware captures the storage reference at import
// time, so patching window.localStorage in beforeEach is too late.
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

// Vitest doesn't load .env.local, so the env-validating module crashes at
// import. Stub it with sensible defaults. We also have to stub the API client
// module because it `import "server-only"` at the top, which throws under
// jsdom.
// Override the global next/image mock with a real React passthrough so Logo
// doesn't crash.
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

// The view fetches decks through a server action. Mock the module so we
// can dictate the data shape and lifecycle from each test.
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

// JSDOM doesn't implement HTMLDialogElement's modal lifecycle.
beforeEach(() => {
	if (typeof HTMLDialogElement !== "undefined") {
		HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
			this.removeAttribute("open");
		});
	}
});

const mockedList = vi.mocked(listDecksAction);
const mockedGetDeck = vi.mocked(getDeckAction);
const mockedGetDeckWithStats = vi.mocked(getDeckWithStatsAction);

afterEach(() => {
	mockedList.mockReset();
	mockedGetDeck.mockReset();
	mockedGetDeckWithStats.mockReset();
	if (typeof window !== "undefined")
		window.localStorage.clear();
});

describe("deckListView", () => {
	describe("renders main content", () => {
		it("renders the Decks page title", async () => {
			mockedList.mockResolvedValueOnce({
				items: [makeDeck({ id: "deck-1", name: "Core 2k Vocabulary" })],
				nextCursor: null,
				hasMore: false,
			});
			mockedGetDeck.mockResolvedValue(makeDeckWithStats());
			mockedGetDeckWithStats.mockResolvedValue(makeDeckWithStats());

			renderWithProviders(<DeckListView />);
			await waitFor(() => {
				const titles = screen.getAllByText("Decks");
				expect(titles.length).toBeGreaterThan(0);
			});
		});

		it("renders a deck name once the query resolves", async () => {
			mockedList.mockResolvedValueOnce({
				items: [makeDeck({ id: "deck-1", name: "Core 2k Vocabulary" })],
				nextCursor: null,
				hasMore: false,
			});
			mockedGetDeck.mockResolvedValue(makeDeckWithStats({ id: "deck-1" }));
			mockedGetDeckWithStats.mockResolvedValue(makeDeckWithStats({ id: "deck-1" }));

			renderWithProviders(<DeckListView />);

			expect(await screen.findByText("Core 2k Vocabulary")).toBeInTheDocument();
		});
	});

	describe("empty state", () => {
		it("renders the first-deck empty state when the list resolves to no items", async () => {
			mockedList.mockResolvedValueOnce({
				items: [],
				nextCursor: null,
				hasMore: false,
			});
			mockedGetDeck.mockResolvedValue(null);
			mockedGetDeckWithStats.mockResolvedValue(null);

			renderWithProviders(<DeckListView />);

			// The empty state always renders a CTA to create the first deck.
			expect(
				await screen.findByRole("button", { name: /create.*deck|new deck/i }),
			).toBeInTheDocument();
		});
	});

	describe("interactions", () => {
		it("opens the Create Deck dialog when the 'New deck' top-bar action is clicked", async () => {
			mockedList.mockResolvedValueOnce({
				items: [makeDeck()],
				nextCursor: null,
				hasMore: false,
			});
			mockedGetDeck.mockResolvedValue(makeDeckWithStats());
			mockedGetDeckWithStats.mockResolvedValue(makeDeckWithStats());

			const { user } = renderWithProviders(<DeckListView />);

			// Wait for hydration to drop the PageLoader.
			await screen.findAllByText("Decks");

			const newDeckBtn = await screen.findByRole("button", { name: /new deck/i });
			await user.click(newDeckBtn);

			expect(
				await screen.findByRole("heading", { name: /new deck/i }),
			).toBeInTheDocument();
		});
	});
});
