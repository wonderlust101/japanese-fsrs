"use server";

import type { ApiBatchDiagnoseResult, ApiBatchResult, ApiDueCard, ApiForecastDay, ApiList, ApiRatingsPreview, ApiReviewedCard, SessionSummary, SubmitReviewInput } from "@fsrs-japanese/shared-types";
import {
	ApiBatchDiagnoseResultSchema,
	ApiBatchResultSchema,
	ApiDueCardSchema,
	ApiForecastDaySchema,
	apiListEnvelope,
	ApiRatingsPreviewSchema,
	ApiReviewedCardSchema,
	ApiReviewSubmitResponseSchema,
	SessionSummarySchema,
	voidResponseSchema,

} from "@fsrs-japanese/shared-types";
import { apiCall, apiCallSafe } from "@/lib/api/client";

export async function getDueCardsAction(): Promise<ApiList<ApiDueCard>> {
	return apiCall<ApiList<ApiDueCard>>(
		"/api/v1/reviews/due",
		apiListEnvelope(ApiDueCardSchema),
		{},
		"Failed to fetch due cards",
	);
}

export async function submitReviewAction(
	cardId: SubmitReviewInput["cardId"],
	rating: SubmitReviewInput["rating"],
	reviewTimeMs?: SubmitReviewInput["reviewTimeMs"],
	sessionId?: SubmitReviewInput["sessionId"],
	idempotencyKey?: string,
): Promise<ApiReviewedCard> {
	// Server requires the header — generate one per call when the caller doesn't
	// supply one. Direct-from-UI submits use a fresh key per click; offline-queue
	// retries reuse the queue entry's stored key.
	const key = idempotencyKey ?? crypto.randomUUID();
	return apiCall<ApiReviewedCard>(
		"/api/v1/reviews/submit",
		ApiReviewSubmitResponseSchema,
		{
			method: "POST",
			headers: { "Idempotency-Key": key },
			body: JSON.stringify({ cardId, rating, reviewTimeMs, sessionId }),
		},
		"Failed to submit review",
	);
}

export async function getSessionSummaryAction(sessionId: string): Promise<SessionSummary> {
	return apiCall<SessionSummary>(
		`/api/v1/reviews/session-summary/${encodeURIComponent(sessionId)}`,
		SessionSummarySchema,
		{},
		"Failed to fetch session summary",
	);
}

/**
 * Session-close signal — fire-and-forget. Tells the API the session is finished
 * so it can precompute the day-reflection + weak-spot diagnoses server-side
 * (the API returns 202 immediately). The caller voids this; the result is
 * unused and a failure is harmless (the summary load path regenerates on a
 * miss), so it uses the safe client and never throws.
 */
export async function closeSessionAction(sessionId: string): Promise<void> {
	await apiCallSafe<unknown>(
		`/api/v1/reviews/sessions/${encodeURIComponent(sessionId)}/close`,
		voidResponseSchema,
		{ method: "POST", body: JSON.stringify({}) },
		null,
	);
}

// Batch diagnose all undiagnosed weak spots for a session. Returns a tally.
// Uses `apiCall` (not safe) because the caller needs to know whether the
// mutation succeeded so it can decide to invalidate the session-summary
// query. Per-row failures are absorbed server-side; the wire response is
// always 200 with the tally unless the auth/rate-limit gate fails.
export async function batchDiagnoseSessionWeakSpotsAction(
	sessionId: string,
): Promise<ApiBatchDiagnoseResult> {
	return apiCall<ApiBatchDiagnoseResult>(
		`/api/v1/reviews/sessions/${encodeURIComponent(sessionId)}/diagnose-weak-spots`,
		ApiBatchDiagnoseResultSchema,
		{
			method: "POST",
			headers: { "Idempotency-Key": crypto.randomUUID() },
			body: JSON.stringify({}),
		},
		"Failed to diagnose session weak spots",
	);
}

export async function submitBatchAction(
	reviews: SubmitReviewInput[],
	idempotencyKey?: string,
): Promise<ApiBatchResult<ApiReviewedCard>> {
	const key = idempotencyKey ?? crypto.randomUUID();
	return apiCall<ApiBatchResult<ApiReviewedCard>>(
		"/api/v1/reviews/batch",
		ApiBatchResultSchema(ApiReviewedCardSchema),
		{
			method: "POST",
			headers: { "Idempotency-Key": key },
			body: JSON.stringify({ reviews }),
		},
		"Failed to submit batch",
	);
}

/**
 * Undoes a specific review log entry and restores the card to its
 * pre-review state. Backed by `POST /api/v1/reviews/:reviewLogId/rollback`.
 *
 * The server returns 409 if the log was written before the before-snapshot
 * migration (rare; only old accounts). Errors surface to the caller as
 * `Error.message`.
 */
export async function rollbackReviewAction(reviewLogId: string): Promise<void> {
	await apiCall<unknown>(
		`/api/v1/reviews/${encodeURIComponent(reviewLogId)}/rollback`,
		voidResponseSchema,
		{
			method: "POST",
			headers: { "Idempotency-Key": crypto.randomUUID() },
			body: JSON.stringify({}),
		},
		"Failed to roll back review",
	);
}

export async function getRatingsPreviewAction(cardId: string): Promise<ApiRatingsPreview> {
	return apiCall<ApiRatingsPreview>(
		`/api/v1/reviews/${encodeURIComponent(cardId)}/preview`,
		ApiRatingsPreviewSchema,
		{},
		"Failed to fetch ratings preview",
	);
}

export async function getReviewForecastAction(): Promise<ApiList<ApiForecastDay>> {
	return apiCall<ApiList<ApiForecastDay>>(
		"/api/v1/reviews/forecast",
		apiListEnvelope(ApiForecastDaySchema),
		{},
		"Failed to fetch forecast",
	);
}
