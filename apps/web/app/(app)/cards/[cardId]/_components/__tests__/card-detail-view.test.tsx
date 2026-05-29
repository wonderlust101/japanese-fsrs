import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCardByIdAction } from "@/lib/actions/cards.actions";

import { makeCard } from "@/test/factories";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

import { CardDetailView } from "../card-detail-view";

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
	getCardByIdAction: vi.fn(),
	deleteCardAction: vi.fn(),
	moveCardAction: vi.fn(),
	copyCardAction: vi.fn(),
	suspendCardAction: vi.fn(),
	unsuspendCardAction: vi.fn(),
	forgetCardAction: vi.fn(),
	rescheduleCardAction: vi.fn(),
	bulkMoveCardsAction: vi.fn(),
	bulkSuspendCardsAction: vi.fn(),
	bulkUnsuspendCardsAction: vi.fn(),
	bulkDeleteCardsAction: vi.fn(),
}));

vi.mock("@/lib/actions/decks.actions", () => ({
	listDecksAction: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
	listDecksWithStatsAction: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
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

const mockedGetCard = vi.mocked(getCardByIdAction);

afterEach(() => {
	mockedGetCard.mockReset();
});

describe("cardDetailView", () => {
	describe("loading state", () => {
		it("renders a PageLoader while the card query is in flight", () => {
			mockedGetCard.mockReturnValueOnce(new Promise(() => {}));

			renderWithProviders(
				<CardDetailView cardId="card-1" deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			// PageLoader doesn't carry a heading; assert the back link is the only
			// chrome rendered (label points to the deck).
			expect(
				screen.getByRole("link", { name: /back to n5 vocabulary/i }),
			).toBeInTheDocument();
		});
	});

	describe("renders main content", () => {
		it("renders the card headword in the identity header", async () => {
			mockedGetCard.mockResolvedValue(
				makeCard({
					id: "card-1",
					fieldsData: {
						word: "桜",
						reading: "さくら",
						meaning: "cherry blossom",
					},
				}),
			);

			renderWithProviders(
				<CardDetailView cardId="card-1" deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			await waitFor(() => {
				const word = screen.getAllByText("桜");
				expect(word.length).toBeGreaterThan(0);
			});
		});

		it("renders the back link with the deck name", async () => {
			mockedGetCard.mockResolvedValue(makeCard());
			renderWithProviders(
				<CardDetailView cardId="card-1" deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			await waitFor(() => {
				expect(
					screen.getByRole("link", { name: /back to n5 vocabulary/i }),
				).toBeInTheDocument();
			});
		});
	});

	describe("interactions", () => {
		it("opens the delete dialog when the Delete action is clicked", async () => {
			mockedGetCard.mockResolvedValue(
				makeCard({
					fieldsData: {
						word: "桜",
						reading: "さくら",
						meaning: "cherry blossom",
					},
				}),
			);
			const { user } = renderWithProviders(
				<CardDetailView cardId="card-1" deckId="deck-1" deckName="N5 Vocabulary" />,
			);

			// Wait for the card to load so the actions strip is rendered.
			await screen.findAllByText("桜");

			await user.click(screen.getByRole("button", { name: /^delete/i }));

			expect(
				await screen.findByRole("heading", { name: /delete card/i }),
			).toBeInTheDocument();
		});

		it("opens the suspend dialog when the Suspend action is clicked", async () => {
			mockedGetCard.mockResolvedValue(
				makeCard({
					isSuspended: false,
					fieldsData: {
						word: "桜",
						reading: "さくら",
						meaning: "cherry blossom",
					},
				}),
			);
			const { user } = renderWithProviders(
				<CardDetailView cardId="card-1" deckId="deck-1" deckName="N5 Vocabulary" />,
			);
			await screen.findAllByText("桜");

			await user.click(screen.getByRole("button", { name: /suspend/i }));

			expect(
				await screen.findByRole("heading", { name: /suspend card/i }),
			).toBeInTheDocument();
		});
	});
});
