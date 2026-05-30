import type { ApiReviewedCard, ApiWeakSpotDrillSessionDetail } from "@fsrs-japanese/shared-types";

import { afterEach, describe, expect, it, vi } from "vitest";

import { submitReviewAction } from "@/lib/actions/reviews.actions";

import { getDrillSessionAction } from "@/lib/actions/weak-spots.actions";

import { useWeakSpotDrillSessionStore } from "@/stores/useWeakSpotDrillSessionStore";

import { renderWithProviders, screen } from "@/test/test-utils";

import { DrillSessionClient } from "../drill-session-client";

// Characterization test. Covers the cold-boot frame and the active drill state
// (driven by the Zustand store, which the bootstrap effect seeds from the
// session query). The active cases pin the real-review override sub-feature
// ahead of its extraction into use-drill-override; behaviour must survive the
// extraction unchanged.

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

vi.mock("@/lib/actions/weak-spots.actions", () => ({
	listWeakSpotsAction: vi.fn(),
	getWeakSpotAction: vi.fn(),
	diagnoseWeakSpotAction: vi.fn(),
	createDrillSessionAction: vi.fn(),
	getDrillSessionAction: vi.fn(),
	recordDrillAttemptAction: vi.fn(),
	finishDrillSessionAction: vi.fn(),
	abortDrillSessionAction: vi.fn(),
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

const mockedGetSession = vi.mocked(getDrillSessionAction);
const mockedSubmitReview = vi.mocked(submitReviewAction);

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

// Two active cards so submitting card 0 advances to card 1 (still active) rather
// than exhausting the queue, which would trigger auto-finish + navigation and
// unmount the success toast before it can be asserted.
function makeActiveDetail(): ApiWeakSpotDrillSessionDetail {
	return {
		sessionId: SESSION_ID,
		status: "active",
		isCanonicalStateStale: false,
		staleCards: [],
		cards: [
			{
				sessionCardId: "22222222-2222-4222-8222-222222222222",
				weakSpotId: "33333333-3333-4333-8333-333333333333",
				cardId: "44444444-4444-4444-8444-444444444444",
				ordinal: 0,
				layoutType: "vocabulary",
				fieldsData: { word: "猫", reading: "ねこ", meaning: "cat" },
				lapses: 8,
				isOrphaned: false,
				isStale: false,
			},
			{
				sessionCardId: "55555555-5555-4555-8555-555555555555",
				weakSpotId: "66666666-6666-4666-8666-666666666666",
				cardId: "77777777-7777-4777-8777-777777777777",
				ordinal: 1,
				layoutType: "vocabulary",
				fieldsData: { word: "犬", reading: "いぬ", meaning: "dog" },
				lapses: 8,
				isOrphaned: false,
				isStale: false,
			},
		],
	};
}

afterEach(() => {
	mockedGetSession.mockReset();
	mockedSubmitReview.mockReset();
	// The drill store is a module-level singleton; reset to idle so an active
	// session from one test can't leak into the next.
	useWeakSpotDrillSessionStore.getState().actions.reset();
});

describe("drillSessionClient", () => {
	it("mounts and renders the drill frame on a cold-boot load failure", async () => {
		mockedGetSession.mockRejectedValueOnce(new Error("offline"));

		renderWithProviders(<DrillSessionClient sessionId={SESSION_ID} />);

		// DrillFrame wraps every state via the shared SessionTopBar; its
		// "End drill" control (desktop + mobile variants) signals the mount.
		expect((await screen.findAllByRole("button", { name: /end drill/i })).length).toBeGreaterThan(0);
	});

	it("seeds the store and renders the active card with a reveal control", async () => {
		mockedGetSession.mockResolvedValue(makeActiveDetail());

		renderWithProviders(<DrillSessionClient sessionId={SESSION_ID} />);

		expect(await screen.findByRole("button", { name: /show answer/i })).toBeInTheDocument();
	});

	it("opens the real-review override panel after revealing the answer", async () => {
		mockedGetSession.mockResolvedValue(makeActiveDetail());
		const { user } = renderWithProviders(<DrillSessionClient sessionId={SESSION_ID} />);

		await user.click(await screen.findByRole("button", { name: /show answer/i }));
		await user.click(await screen.findByRole("button", { name: /count this drill answer as a real review/i }));

		// RealReviewConfirmBar headline.
		expect(await screen.findByText(/counts as a real review/i)).toBeInTheDocument();
	});

	it("submits a drill answer as a real review and shows the confirmation toast", async () => {
		mockedGetSession.mockResolvedValue(makeActiveDetail());
		// onSuccess ignores the resolved value; cast a minimal stand-in.
		mockedSubmitReview.mockResolvedValue({} as ApiReviewedCard);
		const { user } = renderWithProviders(<DrillSessionClient sessionId={SESSION_ID} />);

		await user.click(await screen.findByRole("button", { name: /show answer/i }));
		await user.click(await screen.findByRole("button", { name: /count this drill answer as a real review/i }));
		await user.click(await screen.findByRole("button", { name: /again \(press 1\)/i }));

		expect(await screen.findByText(/counted as a real review/i)).toBeInTheDocument();
	});
});
