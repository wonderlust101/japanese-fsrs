import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	moveCardAction,
	updateCardAction,
} from "@/lib/actions/cards.actions";

import { makeCard } from "@/test/factories";

import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

import { EditCardClient } from "../edit-card-client";

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
	updateCardAction: vi.fn(),
	moveCardAction: vi.fn(),
	generateMnemonicAction: vi.fn(),
	generateSentencesAction: vi.fn(),
	generateSentencesByWordAction: vi.fn(),
	getCardByIdAction: vi.fn(),
}));

const mockedUpdate = vi.mocked(updateCardAction);
const mockedMove = vi.mocked(moveCardAction);

const DECK_OPTIONS = [
	{ id: "deck-1", name: "N5 Vocabulary" },
	{ id: "deck-2", name: "Travel words" },
];

afterEach(() => {
	mockedUpdate.mockReset();
	mockedMove.mockReset();
	vi.mocked(useRouter).mockReset();
});

describe("editCardClient", () => {
	describe("renders main content", () => {
		it("renders the Edit card page header", () => {
			renderWithProviders(
				<EditCardClient
					card={makeCard()}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);
			// The title uses a typographic apostrophe (U+2019) — match by prefix
			// so the assertion is robust to that.
			expect(screen.getByRole("heading", { name: /update what/i })).toBeInTheDocument();
		});

		it("seeds the Meaning field from the persisted card", () => {
			renderWithProviders(
				<EditCardClient
					card={makeCard({
						fieldsData: {
							word: "桜",
							reading: "さくら",
							meaning: "cherry blossom",
						},
					})}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);

			expect(screen.getByLabelText(/meaning/i)).toHaveValue("cherry blossom");
		});

		it("renders Save and Cancel actions", () => {
			renderWithProviders(
				<EditCardClient
					card={makeCard()}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);

			expect(screen.getByRole("button", { name: /^save/i })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /^cancel/i })).toBeInTheDocument();
		});
	});

	describe("validation", () => {
		it("escalates the missing-definition requirement after a blocked save attempt", async () => {
			const { user } = renderWithProviders(
				<EditCardClient
					card={makeCard({
						fieldsData: {
							word: "猫",
							reading: "ねこ",
							meaning: "cat",
						},
					})}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);

			// Wipe the definition then try to save — Save attempts to commit,
			// the blocker fires, and the requirement copy escalates.
			await user.clear(screen.getByLabelText(/meaning/i));
			await user.click(screen.getByRole("button", { name: /^save/i }));

			// The requirement copy uses "Keep a definition" — the exact string
			// from the component's blockers list.
			expect(await screen.findByText(/keep a definition/i)).toBeInTheDocument();
			expect(mockedUpdate).not.toHaveBeenCalled();
		});
	});

	describe("submit", () => {
		it("calls updateCardAction with the card id, version, and edited fields", async () => {
			mockedUpdate.mockResolvedValueOnce(makeCard());
			const { user } = renderWithProviders(
				<EditCardClient
					card={makeCard({
						id: "card-1",
						version: 3,
						fieldsData: {
							word: "猫",
							reading: "ねこ",
							meaning: "cat",
						},
					})}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);

			await user.clear(screen.getByLabelText(/meaning/i));
			await user.type(screen.getByLabelText(/meaning/i), "a small carnivore");
			await user.click(screen.getByRole("button", { name: /^save/i }));

			await waitFor(() => {
				expect(mockedUpdate).toHaveBeenCalledWith(
					"card-1",
					3,
					expect.objectContaining({
						fieldsData: expect.objectContaining({ meaning: "a small carnivore" }),
					}),
				);
			});
		});

		it("surfaces a friendly error when the save fails", async () => {
			mockedUpdate.mockRejectedValueOnce(new Error("412 If-Match conflict"));
			const { user } = renderWithProviders(
				<EditCardClient
					card={makeCard({
						fieldsData: {
							word: "猫",
							reading: "ねこ",
							meaning: "cat",
						},
					})}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);

			await user.clear(screen.getByLabelText(/meaning/i));
			await user.type(screen.getByLabelText(/meaning/i), "a small carnivore");
			await user.click(screen.getByRole("button", { name: /^save/i }));

			expect(
				await screen.findByText(/couldn't save your changes/i),
			).toBeInTheDocument();
		});
	});

	describe("unsaved-changes warning", () => {
		it("attaches a beforeunload listener once the form goes dirty", async () => {
			const addSpy = vi.spyOn(window, "addEventListener");
			const { user } = renderWithProviders(
				<EditCardClient
					card={makeCard({
						fieldsData: {
							word: "猫",
							reading: "ねこ",
							meaning: "cat",
						},
					})}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);

			// Before any edit: no beforeunload listener was attached.
			expect(addSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(false);

			await user.type(screen.getByLabelText(/meaning/i), " more");

			await waitFor(() => {
				expect(addSpy.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);
			});

			addSpy.mockRestore();
		});
	});

	describe("cancel", () => {
		it("returns to the card detail when there is no in-app history", async () => {
			const push = vi.fn();
			vi.mocked(useRouter).mockReturnValue({
				push,
				replace: vi.fn(),
				refresh: vi.fn(),
				back: vi.fn(),
				forward: vi.fn(),
				prefetch: vi.fn(),
			});
			// Force the "history.length <= 1" branch so cancel calls push().
			Object.defineProperty(window, "history", {
				configurable: true,
				value: { length: 1, pushState: vi.fn(), replaceState: vi.fn() },
			});

			const { user } = renderWithProviders(
				<EditCardClient
					card={makeCard({ id: "card-1" })}
					deckName="N5 Vocabulary"
					decks={DECK_OPTIONS}
				/>,
			);

			await user.click(screen.getByRole("button", { name: /^cancel/i }));
			expect(push).toHaveBeenCalledWith("/cards/card-1");
		});
	});
});
