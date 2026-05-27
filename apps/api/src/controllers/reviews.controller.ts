import type { RequestHandler } from "express";

import {
	batchReviewSchema,
	previewRatingsParamSchema,
	rollbackReviewParamSchema,
	sessionSummaryParamsSchema,
	submitReviewSchema,
} from "@fsrs-japanese/shared-types";

import { withIdempotency } from "../lib/idempotency.ts";
import { emptyBodySchema } from "../schemas/weak-spot.schema.ts";
import * as dayReflectionService from "../services/day-reflection.service.ts";
import { previewCardRatings, processReview, rollbackReview } from "../services/fsrs.service.ts";
import * as profileService from "../services/profile.service.ts";
import * as reviewService from "../services/review.service.ts";
import * as weakSpotService from "../services/weak-spot.service.ts";

/**
 * GET /api/v1/reviews/due
 * Returns the cards the authenticated user should review now, capped by their
 * daily review and new-card limits.
 */
export const getDue: RequestHandler = async (req, res): Promise<void> => {
	const profile = await profileService.getProfile(req.user.id);
	const cards = await reviewService.getDueCards(req.user.id, profile);
	res.json(cards);
};

/**
 * POST /api/v1/reviews/submit
 * Submits a single review rating and updates the card's FSRS scheduling state.
 * Returns the updated scheduling fields raw (matches the create/update endpoints
 * for decks and cards). Requires `Idempotency-Key` header — same key + same
 * body replays the original response without re-running FSRS.
 */
export const submit: RequestHandler = async (req, res): Promise<void> => {
	const input = submitReviewSchema.parse(req.body);
	const { status, body } = await withIdempotency(
		req.user.id,
		req.header("idempotency-key"),
		input,
		async () => {
			const result = await processReview(
				input.cardId,
				input.rating,
				req.user.id,
				input.reviewTimeMs,
				input.sessionId,
			);
			return { status: 200, body: result };
		},
	);
	res.status(status).json(body);
};

/**
 * POST /api/v1/reviews/batch
 * Submits a batch of offline-buffered reviews. Processes each review
 * sequentially to avoid races. Partial failures are returned in `errors`
 * without aborting the remainder of the batch. Requires `Idempotency-Key`
 * header — keyed per logical batch attempt; retries from the offline queue
 * reuse the same key and replay the stored response.
 */
export const batch: RequestHandler = async (req, res): Promise<void> => {
	const input = batchReviewSchema.parse(req.body);
	const { status, body } = await withIdempotency(
		req.user.id,
		req.header("idempotency-key"),
		input,
		async () => {
			const result = await reviewService.submitBatch(input.reviews, req.user.id, { signal: req.signal });
			return { status: 200, body: result };
		},
	);
	res.status(status).json(body);
};

/**
 * GET /api/v1/reviews/forecast
 * Returns backlog, scheduled review, and actual new-card counts per day for
 * the next 14 days.
 * Days with zero due cards are omitted from the response array.
 */
export const forecast: RequestHandler = async (req, res): Promise<void> => {
	const profile = await profileService.getProfile(req.user.id);
	const data = await reviewService.getReviewForecast(req.user.id, profile);
	res.json(data);
};

/**
 * GET /api/v1/reviews/session-summary/:sessionId
 * Returns aggregate stats for a completed review session: total cards, time
 * spent, accuracy, per-rating breakdown, and any weakSpots triggered.
 */
export const sessionSummary: RequestHandler = async (req, res): Promise<void> => {
	const { sessionId } = sessionSummaryParamsSchema.parse(req.params);
	const profile = await profileService.getProfile(req.user.id);
	const summary = await reviewService.getSessionSummary(sessionId, req.user.id, profile);
	res.json(summary);
};

/**
 * GET /api/v1/reviews/day-reflection/:sessionId
 *
 * Returns one Tomo-voice reflection over the user's review work for the
 * local-calendar day that contains the given session. Aggregates ALL
 * sessions on that date; regenerates whenever a new session joins the day
 * (session-IDs fingerprint changes → cache miss → fresh AI generation).
 *
 * Falls back to a rule-based body (with `source: 'fallback'`) when the AI
 * path is unavailable; the endpoint never surfaces a 5xx for content-
 * availability reasons. Reuses the `sessionSummaryParamsSchema` since the
 * path parameter shape is identical.
 */
export const dayReflection: RequestHandler = async (req, res): Promise<void> => {
	const { sessionId } = sessionSummaryParamsSchema.parse(req.params);
	const reflection = await dayReflectionService.getDayReflection(sessionId, req.user.id);
	res.json(reflection);
};

/**
 * POST /api/v1/reviews/sessions/:sessionId/diagnose-weak-spots
 *
 * Fires AI diagnosis for every undiagnosed weak spot in the session in
 * one batched operation. Each per-row diagnose call is rate-limit-aware
 * via the existing `diagnoseWeakSpot` pipeline. Returns a tally;
 * per-row failures are counted, not propagated.
 */
export const diagnoseSessionWeakSpots: RequestHandler = async (req, res): Promise<void> => {
	const { sessionId } = sessionSummaryParamsSchema.parse(req.params);
	const result = await weakSpotService.batchDiagnoseForSession(req.user.id, sessionId);
	res.json(result);
};

/**
 * POST /api/v1/reviews/:reviewLogId/rollback
 * Undoes a specific review by restoring the card's pre-review FSRS state from
 * the review_log's before-snapshot. The log itself is preserved as an
 * immutable audit trail. Throws 404 if the log doesn't belong to the user,
 * 409 if the log is pre-migration (no before-snapshot was captured).
 *
 * Requires `Idempotency-Key` header — same key + same reviewLogId returns
 * the original response without re-running the rollback. The service is
 * naturally idempotent for a given log_id (second call finds the card
 * already in the rolled-back state and writes the same values).
 */
export const rollback: RequestHandler = async (req, res): Promise<void> => {
	const { reviewLogId } = rollbackReviewParamSchema.parse(req.params);
	emptyBodySchema.parse(req.body ?? {});

	const { status, body } = await withIdempotency(
		req.user.id,
		req.header("idempotency-key"),
		{ reviewLogId },
		async () => {
			const result = await rollbackReview(req.user.id, reviewLogId);
			return { status: 200, body: result };
		},
	);
	res.status(status).json(body);
};

/**
 * GET /api/v1/reviews/:cardId/preview
 * Anki-style "what happens if I rate this?" preview for the four ratings on
 * an owned card. Pure computation: no database writes, no idempotency key.
 *
 * The `due` field on each rating is serialized to ISO string (the service
 * returns a Date; res.json() handles the conversion via JSON.stringify).
 */
export const previewRatings: RequestHandler = async (req, res): Promise<void> => {
	const { cardId } = previewRatingsParamSchema.parse(req.params);
	const preview = await previewCardRatings(cardId, req.user.id);
	res.json({
		again: { scheduledDays: preview.again.scheduledDays, due: preview.again.due.toISOString() },
		hard: { scheduledDays: preview.hard.scheduledDays, due: preview.hard.due.toISOString() },
		good: { scheduledDays: preview.good.scheduledDays, due: preview.good.due.toISOString() },
		easy: { scheduledDays: preview.easy.scheduledDays, due: preview.easy.due.toISOString() },
	});
};
