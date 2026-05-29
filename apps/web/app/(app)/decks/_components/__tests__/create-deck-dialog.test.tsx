import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeckAction } from "@/lib/actions/decks.actions";

import { queryKeys } from "@/lib/api/queryKeys";

import { makeDeck } from "@/test/factories";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

import { CreateDeckDialog } from "../create-deck-dialog";

// Server action that talks to the API. Mocked so we can assert the payload
// shape without standing up the full request lifecycle (the action itself
// is "server-only" — importing the real module from a jsdom test would fail).
vi.mock("@/lib/actions/decks.actions", () => ({
	createDeckAction: vi.fn(),
	listDecksAction: vi.fn(),
	listDecksWithStatsAction: vi.fn(),
	listDecksStrictAction: vi.fn(),
	getDeckAction: vi.fn(),
	getDeckWithStatsAction: vi.fn(),
	deleteDeckAction: vi.fn(),
	updateDeckAction: vi.fn(),
	copyDeckAction: vi.fn(),
	archiveDeckAction: vi.fn(),
	unarchiveDeckAction: vi.fn(),
}));

const mockedCreateDeckAction = vi.mocked(createDeckAction);

// JSDOM doesn't implement HTMLDialogElement's modal lifecycle. Patch in a
// no-op so the Dialog's useEffect doesn't throw when it tries to open.
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

afterEach(() => {
	mockedCreateDeckAction.mockReset();
});

describe("createDeckDialog", () => {
	describe("renders main content", () => {
		it("shows the dialog heading when open", () => {
			renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);
			expect(screen.getByRole("heading", { name: /new deck/i })).toBeInTheDocument();
		});

		it("renders Name, Description and Type controls", () => {
			renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);
			expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
		});

		it("renders Cancel and Create Deck buttons", () => {
			renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);
			expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /create deck/i })).toBeInTheDocument();
		});
	});

	describe("validation", () => {
		it("disables the submit button when the name is empty", () => {
			renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);
			expect(screen.getByRole("button", { name: /create deck/i })).toBeDisabled();
		});

		it("disables the submit button when the name is whitespace only", async () => {
			const { user } = renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);

			await user.type(screen.getByLabelText(/^name$/i), "   ");
			expect(screen.getByRole("button", { name: /create deck/i })).toBeDisabled();
		});

		it("enables the submit button once a non-whitespace name is present", async () => {
			const { user } = renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);

			await user.type(screen.getByLabelText(/^name$/i), "N5 Vocabulary");
			expect(screen.getByRole("button", { name: /create deck/i })).toBeEnabled();
		});
	});

	describe("submit", () => {
		it("calls createDeckAction with trimmed name, description, and deck type", async () => {
			mockedCreateDeckAction.mockResolvedValueOnce(makeDeck({ id: "deck-new", name: "N5 Vocabulary" }));
			const onClose = vi.fn();
			const { user } = renderWithProviders(<CreateDeckDialog open onClose={onClose} />);

			await user.type(screen.getByLabelText(/^name$/i), "  N5 Vocabulary  ");
			await user.type(screen.getByLabelText(/description/i), "  Core 800  ");
			await user.click(screen.getByRole("button", { name: /create deck/i }));

			await waitFor(() => {
				expect(mockedCreateDeckAction).toHaveBeenCalledWith({
					name: "N5 Vocabulary",
					description: "Core 800",
					deckType: "vocabulary",
				});
			});
		});

		it("omits description when only whitespace was typed", async () => {
			mockedCreateDeckAction.mockResolvedValueOnce(makeDeck());
			const { user } = renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);

			await user.type(screen.getByLabelText(/^name$/i), "Empty Description Deck");
			await user.type(screen.getByLabelText(/description/i), "   ");
			await user.click(screen.getByRole("button", { name: /create deck/i }));

			await waitFor(() => {
				expect(mockedCreateDeckAction).toHaveBeenCalledWith(
					expect.objectContaining({ description: undefined }),
				);
			});
		});

		it("invalidates the decks list cache and calls onCreated on success", async () => {
			const newDeck = makeDeck({ id: "deck-new", name: "Tea Vocabulary" });
			mockedCreateDeckAction.mockResolvedValueOnce(newDeck);
			const onCreated = vi.fn();
			const onClose = vi.fn();
			const { user, queryClient } = renderWithProviders(
				<CreateDeckDialog open onClose={onClose} onCreated={onCreated} />,
			);
			const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

			await user.type(screen.getByLabelText(/^name$/i), "Tea Vocabulary");
			await user.click(screen.getByRole("button", { name: /create deck/i }));

			await waitFor(() => {
				expect(onCreated).toHaveBeenCalledWith(newDeck);
			});
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.decks.all() });
			// Dialog closes after success.
			expect(onClose).toHaveBeenCalled();
		});

		it("renders a form-level alert when the action rejects", async () => {
			mockedCreateDeckAction.mockRejectedValueOnce(new Error("Deck limit reached"));
			const { user } = renderWithProviders(<CreateDeckDialog open onClose={vi.fn()} />);

			await user.type(screen.getByLabelText(/^name$/i), "Whatever");
			await user.click(screen.getByRole("button", { name: /create deck/i }));

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent(/deck limit reached/i);
		});
	});

	describe("close", () => {
		it("invokes onClose when Cancel is clicked", async () => {
			const onClose = vi.fn();
			const { user } = renderWithProviders(<CreateDeckDialog open onClose={onClose} />);

			await user.click(screen.getByRole("button", { name: /cancel/i }));
			expect(onClose).toHaveBeenCalled();
		});
	});
});
