import type {
	ApiWeakSpotListItem,
	SessionSummary,
	SessionWeakSpot,
} from "@fsrs-japanese/shared-types";
import type { ReactElement, ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { diagnoseWeakSpotAction } from "@/lib/actions/weak-spots.actions";
import { makeSessionSummary } from "@/test/factories/review";
import { queryKeys } from "../queryKeys";
import { useIncrementalSessionDiagnosis } from "../reviews";

// Only diagnoseWeakSpotAction is exercised by useIncrementalSessionDiagnosis;
// stub it so no real fetch is attempted.
vi.mock("@/lib/actions/weak-spots.actions", () => ({
	diagnoseWeakSpotAction: vi.fn(),
}));

// reviews.ts also imports these action modules at load; mock them so the real
// lib/api/client → lib/env (which parses required NEXT_PUBLIC_* vars at import)
// never loads. Mirrors the action-mocking pattern other lib/api tests use.
vi.mock("@/lib/actions/reviews.actions", () => ({
	getDueCardsAction: vi.fn(),
	getRatingsPreviewAction: vi.fn(),
	getReviewForecastAction: vi.fn(),
	getSessionSummaryAction: vi.fn(),
	rollbackReviewAction: vi.fn(),
	submitBatchAction: vi.fn(),
	submitReviewAction: vi.fn(),
}));
vi.mock("@/lib/actions/reflections.actions", () => ({
	getDayReflectionAction: vi.fn(),
}));

const mockDiagnose = vi.mocked(diagnoseWeakSpotAction);

const SESSION_ID = "55555555-5555-5555-5555-555555555555";

function weakSpot(id: string, diagnosis: string | null): SessionWeakSpot {
	return {
		weakSpotId: id,
		cardId: `card-${id}`,
		deckId: "deck-1",
		word: "言葉",
		reading: null,
		diagnosis,
		prescription: diagnosis,
		resolved: false,
		createdAt: "2026-05-31T00:00:00.000Z",
	};
}

// The hook only reads id/diagnosis/prescription off the response, so a minimal
// object cast to the full wire shape is sufficient for the patch assertion.
function diagnosed(id: string): ApiWeakSpotListItem {
	return {
		id,
		diagnosis: `dx-${id}`,
		prescription: `rx-${id}`,
	} as unknown as ApiWeakSpotListItem;
}

function wrapperFor(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }): ReactElement {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	};
}

function makeClient(): QueryClient {
	// gcTime: Infinity — the summary query has no observer in this hook test
	// (the hook reads/writes it via get/setQueryData, never subscribes), so a
	// finite gcTime would garbage-collect the patched entry before we read it.
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: Infinity, staleTime: 0 },
			mutations: { retry: false },
		},
	});
}

describe("useIncrementalSessionDiagnosis", () => {
	beforeEach(() => {
		mockDiagnose.mockReset();
	});

	it("diagnoses only undiagnosed weak spots and patches the summary cache in place (no invalidation)", async () => {
		const client = makeClient();
		const summaryKey = queryKeys.reviews.summary(SESSION_ID);
		const summary = makeSessionSummary({
			sessionId: SESSION_ID,
			weakSpots: [
				weakSpot("ws-1", null),
				weakSpot("ws-2", "already diagnosed"),
				weakSpot("ws-3", null),
			],
		});
		client.setQueryData(summaryKey, summary);

		const invalidateSpy = vi.spyOn(client, "invalidateQueries");
		mockDiagnose.mockImplementation(async (id: string) => diagnosed(id));

		renderHook(() => useIncrementalSessionDiagnosis(SESSION_ID, summary.weakSpots), {
			wrapper: wrapperFor(client),
		});

		// One call per *undiagnosed* weak spot — the already-diagnosed row is skipped.
		await waitFor(() => expect(mockDiagnose).toHaveBeenCalledTimes(2));
		expect(mockDiagnose.mock.calls.map(c => c[0]).sort()).toEqual(["ws-1", "ws-3"]);

		// Each result is patched onto its matching row as it resolves.
		await waitFor(() => {
			const patched = client.getQueryData<SessionSummary>(summaryKey);
			const byId = new Map((patched?.weakSpots ?? []).map(w => [w.weakSpotId, w]));
			expect(byId.get("ws-1")?.diagnosis).toBe("dx-ws-1");
			expect(byId.get("ws-1")?.prescription).toBe("rx-ws-1");
			expect(byId.get("ws-3")?.diagnosis).toBe("dx-ws-3");
		});

		const patched = client.getQueryData<SessionSummary>(summaryKey);
		const byId = new Map((patched?.weakSpots ?? []).map(w => [w.weakSpotId, w]));
		// Pre-diagnosed row is left untouched.
		expect(byId.get("ws-2")?.diagnosis).toBe("already diagnosed");
		// No refetch: the patch is a direct setQueryData, never an invalidate.
		expect(invalidateSpy).not.toHaveBeenCalled();
	});

	it("no-ops for the fixture / ended-early surface (null sessionId)", async () => {
		const client = makeClient();
		const summary = makeSessionSummary({ weakSpots: [weakSpot("ws-1", null)] });

		renderHook(() => useIncrementalSessionDiagnosis(null, summary.weakSpots), {
			wrapper: wrapperFor(client),
		});

		await waitFor(() => expect(mockDiagnose).not.toHaveBeenCalled());
	});

	it("makes no calls when every weak spot already has a diagnosis", async () => {
		const client = makeClient();
		const summary = makeSessionSummary({
			sessionId: SESSION_ID,
			weakSpots: [weakSpot("ws-1", "dx"), weakSpot("ws-2", "dx")],
		});
		client.setQueryData(queryKeys.reviews.summary(SESSION_ID), summary);

		renderHook(() => useIncrementalSessionDiagnosis(SESSION_ID, summary.weakSpots), {
			wrapper: wrapperFor(client),
		});

		await waitFor(() => expect(mockDiagnose).not.toHaveBeenCalled());
	});
});
