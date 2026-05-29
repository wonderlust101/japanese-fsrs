import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	listCardsCrossDeckAction,
} from "@/lib/actions/cards.actions";

import {
	listDecksAction,
} from "@/lib/actions/decks.actions";

import { getCardQualityIssuesAction } from "@/lib/actions/insights.actions";

import { makeCrossDeckCardListItem, makeDeck } from "@/test/factories";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

import { CardsBrowserView } from "../cards-browser-view";

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

// Stub env + the server-only API client so the action import chain doesn't
// crash under jsdom. Replace the global next/image mock so Logo renders.
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

// All cross-deck list traffic + decks list traffic flows through server
// actions. Mock them so we can dictate states from each test.
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

vi.mock("@/lib/actions/insights.actions", () => ({
	getCardQualityIssuesAction: vi.fn().mockResolvedValue([]),
}));

const mockedList = vi.mocked(listCardsCrossDeckAction);
const mockedDecks = vi.mocked(listDecksAction);
const mockedQuality = vi.mocked(getCardQualityIssuesAction);

beforeEach(() => {
	mockedDecks.mockResolvedValue({
		items: [makeDeck()],
		nextCursor: null,
		hasMore: false,
	});
	mockedQuality.mockResolvedValue([]);
});

afterEach(() => {
	mockedList.mockReset();
	mockedDecks.mockReset();
	mockedQuality.mockReset();
});

describe("cardsBrowserView", () => {
	describe("loading state", () => {
		it("renders the Cards top-bar title while the query is in flight", () => {
			// Resolve never — leaves the query in the loading branch.
			mockedList.mockReturnValueOnce(new Promise(() => {}));

			renderWithProviders(<CardsBrowserView />);
			// During cold boot, the page renders the top bar + a PageLoader.
			expect(screen.getAllByText("Cards").length).toBeGreaterThan(0);
		});
	});

	describe("empty state", () => {
		it("renders the first-run empty state when no cards exist and no filters are active", async () => {
			mockedList.mockResolvedValueOnce({
				items: [],
				hasMore: false,
				totalCount: 0,
			});

			renderWithProviders(<CardsBrowserView />);

			// The FirstRunEmptyState surface invites the user to add cards.
			expect(await screen.findByRole("link", { name: /add.*card/i })).toBeInTheDocument();
		});
	});

	describe("success state", () => {
		it("renders the page header and a row for each returned card", async () => {
			const items = [
				makeCrossDeckCardListItem({
					id: "card-1",
					fieldsData: {
						word: "猫",
						reading: "ねこ",
						meaning: "cat",
					},
				}),
				makeCrossDeckCardListItem({
					id: "card-2",
					fieldsData: {
						word: "犬",
						reading: "いぬ",
						meaning: "dog",
					},
				}),
			];
			mockedList.mockResolvedValueOnce({
				items,
				hasMore: false,
				totalCount: 2,
			});

			renderWithProviders(<CardsBrowserView />);

			expect(await screen.findByRole("heading", { name: /all cards/i })).toBeInTheDocument();
			await waitFor(() => {
				// Headword + furigana ruby both render the kanji, so getAllByText.
				expect(screen.getAllByText("猫").length).toBeGreaterThan(0);
				expect(screen.getAllByText("犬").length).toBeGreaterThan(0);
			});
		});
	});

	describe("error state", () => {
		it("renders a retry-capable error pane on a cold-boot failure", async () => {
			mockedList.mockRejectedValueOnce(new Error("upstream offline"));

			renderWithProviders(<CardsBrowserView />);

			expect(
				await screen.findByRole("button", { name: /try again|retry/i }),
			).toBeInTheDocument();
		});
	});
});
