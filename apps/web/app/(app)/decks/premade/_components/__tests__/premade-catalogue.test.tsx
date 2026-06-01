import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listDecksAction } from "@/lib/actions/decks.actions";

import { copyPremadeDeckAction, listPremadeDecksAction } from "@/lib/actions/premade.actions";

import { makePremadeDeck } from "@/test/factories";

import { renderWithProviders, screen } from "@/test/test-utils";

import { PremadeCatalogue } from "../premade-catalogue";

// Characterization test (added 2026-05-30 ahead of the orchestrator → hooks
// refactor). Pins the catalogue's render branches — error, empty, and a
// populated list with the copy CTA — so the extraction of the filter/sort and
// copy hooks is behavior-preserving.

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

vi.mock("@/lib/actions/premade.actions", () => ({
	listPremadeDecksAction: vi.fn(),
	copyPremadeDeckAction: vi.fn(),
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

const mockedPremade = vi.mocked(listPremadeDecksAction);
const mockedUserDecks = vi.mocked(listDecksAction);
const mockedCopy = vi.mocked(copyPremadeDeckAction);

const EMPTY_LIST = { items: [], nextCursor: null, hasMore: false };

beforeEach(() => {
	mockedUserDecks.mockResolvedValue({ ...EMPTY_LIST });
	mockedCopy.mockReset();
});

afterEach(() => {
	mockedPremade.mockReset();
	mockedUserDecks.mockReset();
});

describe("premadeCatalogue", () => {
	it("renders a retryable error pane when the catalogue fails to load", async () => {
		mockedPremade.mockRejectedValueOnce(new Error("offline"));

		renderWithProviders(<PremadeCatalogue />);

		expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
	});

	it("renders the empty state when there are no premade decks", async () => {
		mockedPremade.mockResolvedValue({ ...EMPTY_LIST });

		renderWithProviders(<PremadeCatalogue />);

		expect(await screen.findByText(/no premade decks yet/i)).toBeInTheDocument();
	});

	it("renders a catalogue card with the copy CTA for each deck", async () => {
		mockedPremade.mockResolvedValue({
			items: [makePremadeDeck({ id: "p1", name: "Core N5 Vocabulary" })],
			nextCursor: null,
			hasMore: false,
		});

		renderWithProviders(<PremadeCatalogue />);

		expect(await screen.findByText("Core N5 Vocabulary")).toBeInTheDocument();
		// Accessible name comes from the button's aria-label ("Add <name> to your library").
		expect(screen.getByRole("button", { name: /add .* to your library/i })).toBeInTheDocument();
	});

	it("offers a preview link to the premade source for an uncopied deck", async () => {
		mockedPremade.mockResolvedValue({
			items: [makePremadeDeck({ id: "p1", name: "Core N5 Vocabulary" })],
			nextCursor: null,
			hasMore: false,
		});
		// No user decks copied from p1, so the deck is uncopied → preview routes
		// to the premade source preview, not an owned-deck preview.
		mockedUserDecks.mockResolvedValue({ ...EMPTY_LIST });

		renderWithProviders(<PremadeCatalogue />);

		const previewLink = await screen.findByRole("link", { name: /preview core n5 vocabulary before adding/i });
		expect(previewLink).toHaveAttribute("href", "/decks/premade/p1");
	});
});
