"use server";

import type { ApiWeakSpotDrillAttempt, ApiWeakSpotDrillAttemptResult, ApiWeakSpotDrillSession, ApiWeakSpotDrillSessionDetail, ApiWeakSpotListItem, ApiWeakSpotListResponse } from "@fsrs-japanese/shared-types";
import {
	ApiWeakSpotDrillAttemptSchema,
	ApiWeakSpotDrillSessionDetailSchema,
	ApiWeakSpotDrillSessionSchema,
	ApiWeakSpotListItemSchema,
	ApiWeakSpotListResponseSchema,

} from "@fsrs-japanese/shared-types";

import { apiCall, apiCallSafe } from "@/lib/api/client";

// ─── Filter / sort vocabularies (mirror apps/api/src/schemas/weak-spot.schema.ts) ─

export type WeakSpotStatusFilter = "unresolved" | "resolved";
export type WeakSpotDiagnosisFilter = "available" | "missing";
export type WeakSpotSortOrder
	= | "mostRecent"
		| "oldestUnresolved"
		| "mostLapses"
		| "deckOrder";

export interface ListLeechesOptions {
	status?: WeakSpotStatusFilter;
	deckId?: string;
	jlptLevel?: string;
	diagnosis?: WeakSpotDiagnosisFilter;
	sort?: WeakSpotSortOrder;
	/** Overrides the sort mode's natural direction. Omit for the default. */
	sortDir?: "asc" | "desc";
	/** Free-text query matched against the card's word / reading / meaning. */
	search?: string;
	limit?: number;
	/** 0-indexed row offset for the current page (page * limit). */
	offset?: number;
}

const EMPTY_LIST: ApiWeakSpotListResponse = {
	items: [],
	totalCount: 0,
};

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the unresolved/resolved weakSpot list with optional filters. Uses the
 * "safe" variant so an unauthenticated session or backend hiccup degrades to
 * an empty list rather than tearing down the page — matches how analytics
 * actions treat their non-critical reads.
 */
export async function listWeakSpotsAction(
	opts: ListLeechesOptions = {},
): Promise<ApiWeakSpotListResponse> {
	const params = new URLSearchParams();
	params.set("status", opts.status ?? "unresolved");
	params.set("sort", opts.sort ?? "mostRecent");
	if (opts.sortDir !== undefined)
		params.set("sortDir", opts.sortDir);
	params.set("limit", String(opts.limit ?? 50));
	if (opts.deckId !== undefined)
		params.set("deckId", opts.deckId);
	if (opts.jlptLevel !== undefined)
		params.set("jlptLevel", opts.jlptLevel);
	if (opts.diagnosis !== undefined)
		params.set("diagnosis", opts.diagnosis);
	if (opts.search !== undefined && opts.search.trim().length > 0)
		params.set("search", opts.search.trim());
	if (opts.offset !== undefined && opts.offset > 0)
		params.set("offset", String(opts.offset));

	return apiCallSafe<ApiWeakSpotListResponse>(
		`/api/v1/weak-spots?${params.toString()}`,
		ApiWeakSpotListResponseSchema,
		{},
		EMPTY_LIST,
	);
}

// ─── Detail / lifecycle / diagnosis ───────────────────────────────────────────

export async function getWeakSpotAction(id: string): Promise<ApiWeakSpotListItem> {
	return apiCall<ApiWeakSpotListItem>(
		`/api/v1/weak-spots/${id}`,
		ApiWeakSpotListItemSchema,
		{},
		"Failed to load weakSpot",
	);
}

export async function resolveWeakSpotAction(id: string): Promise<ApiWeakSpotListItem> {
	return apiCall<ApiWeakSpotListItem>(
		`/api/v1/weak-spots/${id}/resolve`,
		ApiWeakSpotListItemSchema,
		{ method: "POST" },
		"Failed to resolve weakSpot",
	);
}

export async function reopenWeakSpotAction(id: string): Promise<ApiWeakSpotListItem> {
	return apiCall<ApiWeakSpotListItem>(
		`/api/v1/weak-spots/${id}/reopen`,
		ApiWeakSpotListItemSchema,
		{ method: "POST" },
		"Failed to reopen weakSpot",
	);
}

/**
 * Triggers AI diagnosis for a weakSpot. The backend requires an
 * `Idempotency-Key` header so OpenAI cost is bounded against retries — we
 * mint a fresh UUID per call. The replay-on-existing semantic on the server
 * means a weakSpot that already has a diagnosis will return the stored values
 * without a re-call even on a fresh key.
 */
export async function diagnoseWeakSpotAction(id: string): Promise<ApiWeakSpotListItem> {
	const idempotencyKey = crypto.randomUUID();
	return apiCall<ApiWeakSpotListItem>(
		`/api/v1/weak-spots/${id}/diagnose`,
		ApiWeakSpotListItemSchema,
		{
			method: "POST",
			headers: { "Idempotency-Key": idempotencyKey },
			body: JSON.stringify({}),
		},
		"Failed to diagnose this weakSpot",
	);
}

// ─── Drill sessions (Phase 2) ────────────────────────────────────────────────

export type CreateDrillSessionInput
	= | {
		source: "unresolvedLeeches";
		deckId?: string;
		jlptLevel?: string;
		order?: "mostRecent" | "mostLapses" | "oldestUnresolved" | "deckOrder";
		limit?: number;
		repeatPolicy?: "none" | "missedAfterLag";
	}
	| {
		source: "deckScoped";
		deckId: string;
		jlptLevel?: string;
		order?: "mostRecent" | "mostLapses" | "oldestUnresolved" | "deckOrder";
		limit?: number;
		repeatPolicy?: "none" | "missedAfterLag";
	}
	| {
		source: "highLapseCandidates";
		jlptLevel?: string;
		minLapses?: number;
		order?: "mostRecent" | "mostLapses" | "oldestUnresolved" | "deckOrder";
		limit?: number;
		repeatPolicy?: "none" | "missedAfterLag";
	}
	| {
		source: "currentCard";
		cardId: string;
		limit?: number;
		repeatPolicy?: "none" | "missedAfterLag";
	}
	| {
		source: "manualSelection";
		cardIds: string[];
		limit?: number;
		repeatPolicy?: "none" | "missedAfterLag";
	};

/**
 * Create a new drill session. The backend requires an `Idempotency-Key`
 * header so a network retry on the start screen doesn't create two parallel
 * sessions. We mint a fresh UUID per call — replay protection is by payload,
 * not by key, so a different payload produces a different session.
 */
export async function createDrillSessionAction(
	input: CreateDrillSessionInput,
): Promise<ApiWeakSpotDrillSession> {
	const idempotencyKey = crypto.randomUUID();
	return apiCall<ApiWeakSpotDrillSession>(
		"/api/v1/weak-spots/drill-sessions",
		ApiWeakSpotDrillSessionSchema,
		{
			method: "POST",
			headers: { "Idempotency-Key": idempotencyKey },
			body: JSON.stringify(input),
		},
		"Failed to create drill session",
	);
}

/**
 * Resume / refresh a drill session. Returns the full queue plus per-row
 * stale flags so the client can warn when canonical scheduler state has
 * changed underneath the snapshot (a real review happened elsewhere).
 */
export async function getDrillSessionAction(
	sessionId: string,
): Promise<ApiWeakSpotDrillSessionDetail> {
	return apiCall<ApiWeakSpotDrillSessionDetail>(
		`/api/v1/weak-spots/drill-sessions/${sessionId}`,
		ApiWeakSpotDrillSessionDetailSchema,
		{},
		"Failed to load drill session",
	);
}

export interface RecordDrillAttemptInput {
	eventId: string;
	sessionCardId: string;
	weakSpotId?: string;
	cardId?: string;
	result: ApiWeakSpotDrillAttemptResult;
	localSequence?: number;
	responseTimeMs?: number;
	shownAt?: string;
	answeredAt?: string;
}

/**
 * Record a drill attempt. The `eventId` is the domain idempotency key —
 * a retry with the same id returns the original row without a second insert.
 * Wire payload mirrors `recordDrillAttemptSchema` from the API; the request
 * body itself is the idempotency key payload (no separate header needed for
 * drill attempts, unlike create/finish).
 */
export async function recordDrillAttemptAction(
	sessionId: string,
	input: RecordDrillAttemptInput,
): Promise<ApiWeakSpotDrillAttempt> {
	return apiCall<ApiWeakSpotDrillAttempt>(
		`/api/v1/weak-spots/drill-sessions/${sessionId}/attempts`,
		ApiWeakSpotDrillAttemptSchema,
		{
			method: "POST",
			headers: { "Idempotency-Key": input.eventId },
			body: JSON.stringify(input),
		},
		"Failed to record drill attempt",
	);
}

/**
 * Mark a drill session finished. Bridges to the post-drill summary surface.
 * Strict-empty body per the backend's `emptyBodySchema`.
 */
export async function finishDrillSessionAction(
	sessionId: string,
): Promise<ApiWeakSpotDrillSessionDetail> {
	return apiCall<ApiWeakSpotDrillSessionDetail>(
		`/api/v1/weak-spots/drill-sessions/${sessionId}/finish`,
		ApiWeakSpotDrillSessionDetailSchema,
		{
			method: "POST",
			body: JSON.stringify({}),
		},
		"Failed to finish drill session",
	);
}

/**
 * Abort a drill session. Used when the learner exits before reaching the
 * end of the queue. Backend treats this as a terminal status — the session
 * cannot be resumed once aborted.
 */
export async function abortDrillSessionAction(
	sessionId: string,
): Promise<ApiWeakSpotDrillSessionDetail> {
	return apiCall<ApiWeakSpotDrillSessionDetail>(
		`/api/v1/weak-spots/drill-sessions/${sessionId}/abort`,
		ApiWeakSpotDrillSessionDetailSchema,
		{
			method: "POST",
			body: JSON.stringify({}),
		},
		"Failed to abort drill session",
	);
}
