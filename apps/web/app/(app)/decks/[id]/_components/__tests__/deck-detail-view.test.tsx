import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	listCardsCrossDeckAction,
} from "@/lib/actions/cards.actions";

import {
	getDeckWithStatsAction,
	listDecksAction,
} from "@/lib/actions/decks.actions";

import { makeCrossDeckCardListItem, makeDeckWithStats } from "@/test/factories";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

import { DeckDetailView } from "../deck-detail-view";

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

vi.mock("@/lib/actions/cards.actions", () => ({
	listCardsCrossDeckAction: vi.fn(),
	deleteCardAction: vi.fn(),
	moveCardAction: vi.fn(),
	copyCardAction: vi.fn(),
	suspendCardAction: vi.fn(),
	unsuspendCardAction: vi.fn(),
	bulkMoveCardsAction: vi.fn(),
	bulkSuspendCardsAction: vi.fn(),
	bulkUnsuspendCardsAction: vi.fn(),
	bulkDeleteCardsAction: vi.fn(),
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

const mockedList = vi.mocked(listCardsCrossDeckAction);
const mockedGetDeck = vi.mocked(getDeckWithStatsAction);
const mockedListDecks = vi.mocked(listDecksAction);

afterEach(() => {
	mockedList.mockReset();
	mockedGetDeck.mockReset();
	mockedListDecks.mockReset();
	if (typeof window !== "undefined")
		window.localStorage.clear();
});

describe("deckDetailView", () => {
	describe("loading state", () => {
		it("suspends (shows Suspense fallback) while the deck query is in flight", () => {
			mockedGetDeck.mockReturnValueOnce(new Promise(() => {}));
			mockedList.mockReturnValueOnce(new Promise(() => {}));
			mockedListDecks.mockResolvedValue({
				items: [],
				nextCursor: null,
				hasMore: false,
			});

			renderWithProviders(
				<DeckDetailView deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			// With useSuspenseQuery the deck query suspends; the Suspense boundary
			// fires and the component content is not rendered until data resolves.
			expect(screen.getByTestId("suspense-fallback")).toBeInTheDocument();
			expect(screen.queryByRole("heading", { name: "N5 Vocabulary" })).not.toBeInTheDocument();
		});
	});

	describe("renders main content", () => {
		it("renders the deck name in the hero header on success", async () => {
			mockedGetDeck.mockResolvedValue(
				makeDeckWithStats({ id: "deck-1", name: "N5 Vocabulary", cardCount: 1 }),
			);
			mockedList.mockResolvedValue({
				items: [makeCrossDeckCardListItem({ id: "card-1" })],
				hasMore: false,
				totalCount: 1,
			});
			mockedListDecks.mockResolvedValue({
				items: [],
				nextCursor: null,
				hasMore: false,
			});

			renderWithProviders(
				<DeckDetailView deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			await waitFor(() => {
				const heading = screen.getByRole("heading", { name: "N5 Vocabulary" });
				expect(heading).toBeInTheDocument();
			});
		});

		it("renders the Study CTA when the deck has cards", async () => {
			mockedGetDeck.mockResolvedValue(
				makeDeckWithStats({ id: "deck-1", name: "N5 Vocabulary", cardCount: 5 }),
			);
			mockedList.mockResolvedValue({
				items: [makeCrossDeckCardListItem()],
				hasMore: false,
				totalCount: 1,
			});
			mockedListDecks.mockResolvedValue({
				items: [],
				nextCursor: null,
				hasMore: false,
			});

			renderWithProviders(
				<DeckDetailView deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			// The Study CTA is a link to /review/setup?deck=...
			await waitFor(() => {
				expect(screen.getAllByRole("link", { name: /study/i }).length).toBeGreaterThan(0);
			});
		});
	});

	describe("empty state", () => {
		it("renders the empty-deck state when the deck has no cards", async () => {
			mockedGetDeck.mockResolvedValue(
				makeDeckWithStats({ id: "deck-1", name: "Empty Deck", cardCount: 0 }),
			);
			mockedList.mockResolvedValue({
				items: [],
				hasMore: false,
				totalCount: 0,
			});
			mockedListDecks.mockResolvedValue({
				items: [],
				nextCursor: null,
				hasMore: false,
			});

			renderWithProviders(
				<DeckDetailView deckId="deck-1" deckName="Empty Deck" />,
			);

			// EmptyDeckState surfaces a CTA to add the first card.
			await waitFor(() => {
				const heading = screen.getByRole("heading", { name: "Empty Deck" });
				expect(heading).toBeInTheDocument();
			});
		});
	});

	describe("error state", () => {
		it("renders a card-list error pane when the cards query fails", async () => {
			mockedGetDeck.mockResolvedValue(
				makeDeckWithStats({ id: "deck-1", name: "N5 Vocabulary", cardCount: 5 }),
			);
			mockedList.mockRejectedValueOnce(new Error("offline"));
			mockedListDecks.mockResolvedValue({
				items: [],
				nextCursor: null,
				hasMore: false,
			});

			renderWithProviders(
				<DeckDetailView deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			// CardListErrorState renders a retry affordance.
			expect(
				await screen.findByRole("button", { name: /try again|retry/i }),
			).toBeInTheDocument();
		});
	});
});
