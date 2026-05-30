import { afterEach, describe, expect, it, vi } from "vitest";

import { getDrillSessionAction } from "@/lib/actions/weak-spots.actions";

import { renderWithProviders, screen } from "@/test/test-utils";

import { DrillSessionClient } from "../drill-session-client";

// Characterization test (added 2026-05-30 ahead of the keyboard-effect
// extraction). The active drill state is driven by the Zustand drill store
// (seeded by the bootstrap effect from the session query) and needs drill-card
// fixtures to exercise. This pins the cold-boot path: the component mounts, the
// query wires, and the shared `DrillFrame` chrome (the "End drill" control)
// renders. The keyboard extraction is a pure effect move within the active
// state, which this branch doesn't reach.

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

afterEach(() => {
	mockedGetSession.mockReset();
});

describe("drillSessionClient", () => {
	it("mounts and renders the drill frame on a cold-boot load failure", async () => {
		mockedGetSession.mockRejectedValueOnce(new Error("offline"));

		renderWithProviders(<DrillSessionClient sessionId="11111111-1111-4111-8111-111111111111" />);

		// DrillFrame wraps every state via the shared SessionTopBar; its
		// "End drill" control (rendered as desktop + mobile variants) is the
		// reliable signal that the component mounted.
		expect((await screen.findAllByRole("button", { name: /end drill/i })).length).toBeGreaterThan(0);
	});
});
