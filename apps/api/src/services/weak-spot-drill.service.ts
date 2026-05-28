// Weak-spot drill-session service: create / fetch / record-attempt / transition.
// Lifted out of weak-spot.service.ts; re-exported from there.

import type { ApiWeakSpotDrillAttempt, ApiWeakSpotDrillSession, ApiWeakSpotDrillSessionDetail } from "@fsrs-japanese/shared-types";
import type { CreateDrillSessionInput, RecordDrillAttemptInput } from "../schemas/weak-spot.schema.ts";
import { assertNever, FieldsDataSchema } from "@fsrs-japanese/shared-types";
import { z } from "zod";
import { supabaseAdmin } from "../db/supabase.ts";
import { asPayload } from "../lib/db.ts";
import { componentLogger } from "../lib/logger.ts";
import { AppError, dbError } from "../middleware/errorHandler.ts";

const log = componentLogger("weakSpot.service");

const DrillSessionCardRowSchema = z.object({
	sessionCardId: z.string().uuid(),
	weakSpotId: z.string().uuid(),
	cardId: z.string().uuid(),
	ordinal: z.number().int().nonnegative(),
	layoutType: z.enum(["vocabulary", "grammar", "sentence"]),
	// FieldsDataSchema (the wire-format union) was widened from
	// `z.record(z.string(), z.unknown())` to a concrete union by Stage 12.
	// The RPC returns DB-validated JSONB so the parse will succeed for any
	// row admitted by `cards_fields_data_shape`; using the same schema here
	// means the inferred type is `FieldsData`, not `Record<string, unknown>`,
	// and the response can be returned directly without a brand cast.
	fieldsData: FieldsDataSchema,
	lapses: z.number().int().nonnegative(),
});

const DrillSessionResponseSchema = z.object({
	sessionId: z.string().uuid(),
	status: z.enum(["active", "finished", "aborted"]),
	cards: z.array(DrillSessionCardRowSchema),
});

/**
 * Wire camelCase → DB snake_case for the `source` enum. The DB CHECK admits
 *  all five values; Stage 6 wired the remaining three through the TS schema.
 */
function sourceToDb(source: CreateDrillSessionInput["source"]): string {
	switch (source) {
		case "unresolvedLeeches": return "unresolved_leeches";
		case "deckScoped": return "deck_scoped";
		case "highLapseCandidates": return "high_lapse_candidates";
		case "manualSelection": return "manual_selection";
		case "currentCard": return "current_card";
		default: return assertNever(source);
	}
}

/** Wire camelCase → DB snake_case for the `repeat_policy` enum. */
function repeatPolicyToDb(policy: CreateDrillSessionInput["repeatPolicy"]): string {
	return policy === "missedAfterLag" ? "missed_after_lag" : "none";
}

/**
 * Creates a persisted drill session for the authenticated user and returns
 * the ordered queue (each card stamped with its `sessionCardId` for Stage 5
 * attempts). The RPC snapshots canonical FSRS state for every queued card so
 * Stage 4's resume endpoint can detect staleness without re-querying the
 * full history.
 *
 * An empty queue is a valid result (status 'active', cards: []) — the caller
 * decides how to surface "nothing to drill right now" in UX.
 *
 * Idempotency: the controller wraps this call in `withIdempotency`, so
 * network retries with the same `Idempotency-Key` + body return the same
 * sessionId rather than creating duplicate sessions.
 */
export async function createDrillSession(
	userId: string,
	input: CreateDrillSessionInput,
): Promise<ApiWeakSpotDrillSession> {
	const { data, error } = await supabaseAdmin.rpc("create_weak_spot_drill_session", asPayload({
		p_user_id: userId,
		p_source: sourceToDb(input.source),
		p_deck_id: input.deckId ?? null,
		p_jlpt_level: input.jlptLevel ?? null,
		p_order: input.order,
		p_limit: input.limit,
		p_mode: input.mode,
		p_repeat_policy: repeatPolicyToDb(input.repeatPolicy),
		p_stop_rule: input.stopRule,
		// source_query is the analytics breadcrumb. Persist the wire-level filters
		// (camelCase) — including the three new source-specific fields — so future
		// analytics queries don't have to reverse-map and can answer "which UX
		// pattern (high-lapse drill / manual pick / single-card drill) does the
		// learner reach for most?" without a JOIN.
		p_source_query: {
			deckId: input.deckId ?? null,
			jlptLevel: input.jlptLevel ?? null,
			cardIds: input.cardIds ?? null,
			cardId: input.cardId ?? null,
			minLapses: input.minLapses ?? null,
			order: input.order,
			limit: input.limit,
		},
		p_card_ids: input.cardIds ?? null,
		p_card_id: input.cardId ?? null,
		p_min_lapses: input.minLapses ?? null,
	}));

	if (error !== null) {
		log.error({ err: { message: error.message, code: error.code } }, "createDrillSession RPC failed");
		throw dbError("create drill session", error);
	}

	// The RPC's RETURNS JSONB carries the full envelope. Parse it through Zod
	// so silent schema drift surfaces as a clean ZodError at this boundary.
	return DrillSessionResponseSchema.parse(data);
}

// ─── Drill session resume (Stage 4) ───────────────────────────────────────────
//
// `GET /api/v1/weak-spots/drill-sessions/:sessionId` returns the persisted queue
// plus an advisory staleness signal — true when the canonical FSRS state of
// at least one queued card has changed since the session was created. The
// staleness check is non-blocking: drilling itself stays safe even when
// stale (drill attempts never read or write `cards`), the flag is just a
// hint for the frontend to suppress "what would happen next" previews.

const DrillSessionDetailCardRowSchema = z.object({
	sessionCardId: z.string().uuid(),
	weakSpotId: z.string().uuid().nullable(),
	cardId: z.string().uuid().nullable(),
	ordinal: z.number().int().nonnegative(),
	layoutType: z.enum(["vocabulary", "grammar", "sentence"]).nullable(),
	// `.nullable()` admits orphan rows (card deleted post-snapshot). See the
	// sibling DrillSessionCardRowSchema comment for the Stage 12 rationale.
	fieldsData: FieldsDataSchema.nullable(),
	lapses: z.number().int().nonnegative().nullable(),
	isOrphaned: z.boolean(),
	isStale: z.boolean(),
});

const DrillSessionDetailResponseSchema = z.object({
	sessionId: z.string().uuid(),
	status: z.enum(["active", "finished", "aborted"]),
	isCanonicalStateStale: z.boolean(),
	staleCards: z.array(z.string().uuid()),
	cards: z.array(DrillSessionDetailCardRowSchema),
});

/**
 * Returns a drill session's full detail for resume: the ordered queue, per-row
 * `isStale` / `isOrphaned` flags, the top-level `isCanonicalStateStale`
 * boolean, and the `staleCards` array of card UUIDs whose stored fingerprint
 * no longer matches the current `cards` state.
 *
 * Throws 404 WEAK_SPOT_DRILL_SESSION_NOT_FOUND when the session doesn't exist or
 * doesn't belong to the authenticated user — the cross-user case is
 * intentionally indistinguishable from "doesn't exist" to avoid leaking
 * existence to other users.
 *
 * The RPC `get_weak_spot_drill_session` (migration 20260601000000) does all the
 * work in one transaction-friendly read: one LEFT JOIN scan against the
 * session's snapshot rows, fingerprint recomputation via the IMMUTABLE helper
 * `compute_card_state_fingerprint_v1`, and JSONB aggregation. The service is
 * purely a forwarder + Zod boundary parser.
 */
export async function getDrillSession(
	userId: string,
	sessionId: string,
): Promise<ApiWeakSpotDrillSessionDetail> {
	const { data, error } = await supabaseAdmin.rpc("get_weak_spot_drill_session", asPayload({
		p_user_id: userId,
		p_session_id: sessionId,
	}));

	if (error !== null) {
		// RPC raises `weak_spot_drill_session_not_found` with SQLSTATE 02000 when the
		// session row doesn't exist for this user. Same precedent as deck.service's
		// DECK_NOT_FOUND translation (see deck.service.ts:225-227).
		if (error.code === "02000" && error.message.includes("weak_spot_drill_session_not_found")) {
			throw new AppError(404, "Drill session not found", { code: "WEAK_SPOT_DRILL_SESSION_NOT_FOUND" });
		}
		log.error({ sessionId, err: { message: error.message, code: error.code } }, "getDrillSession RPC failed");
		throw dbError("fetch drill session", error);
	}

	return DrillSessionDetailResponseSchema.parse(data);
}

// ─── Drill attempts (Stage 5) ─────────────────────────────────────────────────
//
// `POST /api/v1/weak-spots/drill-sessions/:sessionId/attempts` records an
// immutable per-answer event. The DB's `UNIQUE (user_id, event_id)` on
// `weak_spot_drill_attempts` makes eventId the structural idempotency identifier;
// the RPC uses `INSERT ... ON CONFLICT DO NOTHING` + replay-fetch so retrying
// with the same eventId returns the original row instead of creating a
// duplicate.
//
// The wire's `cardId`/`weakSpotId` (when present) are downgraded to consistency
// assertions against the canonical session-card row — mismatches RAISE 22000
// with one of two specific message fragments, which the service translates
// to HTTP 422 `WEAK_SPOT_DRILL_ATTEMPT_ASSERTION_MISMATCH`.

const DrillAttemptResponseSchema = z.object({
	attemptId: z.string().uuid(),
	eventId: z.string().uuid(),
	sessionId: z.string().uuid(),
	sessionCardId: z.string().uuid(),
	weakSpotId: z.string().uuid().nullable(),
	cardId: z.string().uuid().nullable(),
	result: z.enum(["missed", "hesitated", "remembered"]),
	localSequence: z.number().int().nonnegative().nullable(),
	responseTimeMs: z.number().int().nonnegative().nullable(),
	shownAt: z.string().nullable(),
	answeredAt: z.string(),
	createdAt: z.string(),
});

/**
 * Records a drill attempt against the named session-card. Idempotent by
 * `eventId`: a retry with the same `(userId, eventId)` returns the original
 * row rather than minting a new one. The wire-side `cardId`/`weakSpotId`, when
 * supplied, are validated against the canonical session-card values and a
 * mismatch raises 422 `WEAK_SPOT_DRILL_ATTEMPT_ASSERTION_MISMATCH`.
 *
 * Throws:
 *   • 404 WEAK_SPOT_DRILL_SESSION_CARD_NOT_FOUND — session-card row missing or
 *     not owned by the caller / not part of the requested session.
 *   • 422 WEAK_SPOT_DRILL_ATTEMPT_ASSERTION_MISMATCH — body cardId or weakSpotId
 *     disagrees with the canonical session-card values.
 *   • Other DB errors fall through to `dbError` (typically 500, or 409 for
 *     a 23503 FK violation on the rare card-deletion race).
 *
 * Scheduler invariance: the service does not import `fsrs.service.ts`, and
 * the RPC's body contains no UPDATE/DELETE/INSERT against `cards` or
 * `review_logs`. See the property-based test suite in this file's tests for
 * the structural assertion.
 */
export async function recordDrillAttempt(
	userId: string,
	sessionId: string,
	input: RecordDrillAttemptInput,
): Promise<ApiWeakSpotDrillAttempt> {
	const { data, error } = await supabaseAdmin.rpc("record_weak_spot_drill_attempt", asPayload({
		p_user_id: userId,
		p_session_id: sessionId,
		p_event_id: input.eventId,
		p_session_card_id: input.sessionCardId,
		p_asserted_card_id: input.cardId ?? null,
		p_asserted_weak_spot_id: input.weakSpotId ?? null,
		p_result: input.result,
		p_local_sequence: input.localSequence ?? null,
		p_response_time_ms: input.responseTimeMs ?? null,
		p_shown_at: input.shownAt ?? null,
		p_answered_at: input.answeredAt ?? null,
	}));

	if (error !== null) {
		// 404: sessionCardId/sessionId/user triple mismatch.
		if (error.code === "02000" && error.message.includes("weak_spot_drill_session_card_not_found")) {
			throw new AppError(404, "Drill session card not found", {
				code: "WEAK_SPOT_DRILL_SESSION_CARD_NOT_FOUND",
			});
		}
		// 422: body cardId/weakSpotId disagrees with canonical session-card values.
		// Two distinct RAISE message fragments share the same wire code because
		// the client only needs one bit of information: "your assertion was wrong."
		if (error.code === "22000" && (
			error.message.includes("weak_spot_drill_attempt_card_mismatch")
			|| error.message.includes("weak_spot_drill_attempt_weak_spot_mismatch")
		)) {
			throw new AppError(422, "Drill attempt body cardId/weakSpotId does not match the session card", {
				code: "WEAK_SPOT_DRILL_ATTEMPT_ASSERTION_MISMATCH",
			});
		}
		log.error({ sessionId, eventId: input.eventId, err: { message: error.message, code: error.code } }, "recordDrillAttempt RPC failed");
		throw dbError("record drill attempt", error);
	}

	return DrillAttemptResponseSchema.parse(data);
}

// ─── Drill session lifecycle transitions (Stage 6) ────────────────────────────
//
// `POST /api/v1/weak-spots/drill-sessions/:sessionId/finish` and `/abort` flip
// the session's `status` column from `'active'` to the requested terminal
// state. Idempotent on no-op retries (re-finishing a finished session is a
// no-op). Rejects illegal transitions (e.g. finished → aborted) with 409
// WEAK_SPOT_DRILL_SESSION_STATE_CONFLICT.
//
// Two RPC round-trips per call: the transition RPC returns void; the service
// then calls `get_weak_spot_drill_session` for the post-state envelope so the wire
// shape stays identical to the Stage 4 resume response. Frontends can drop
// the response into TanStack Query's session-detail cache directly.

export type DrillSessionTransitionTarget = "finished" | "aborted";

/**
 * Transitions a drill session's status from `'active'` to the requested
 * terminal state (`'finished'` or `'aborted'`). Idempotent: re-finishing a
 * finished session or re-aborting an aborted one is a no-op and returns the
 * current envelope unchanged. Rejects illegal transitions (terminal states
 * are one-way) with 409 `WEAK_SPOT_DRILL_SESSION_STATE_CONFLICT`.
 *
 * Throws:
 *   • 404 WEAK_SPOT_DRILL_SESSION_NOT_FOUND — session row missing or wrong owner.
 *   • 409 WEAK_SPOT_DRILL_SESSION_STATE_CONFLICT — current status is not
 *     `'active'` and the requested target differs, OR target is unknown.
 *   • 500 — RPC fallthrough via `dbError`.
 *
 * Scheduler invariance: the transition RPC writes only
 * `weak_spot_drill_sessions.status`, `finished_at`, and `updated_at`. It does
 * not read or write `cards` or `review_logs`. The follow-up
 * `get_weak_spot_drill_session` call also only reads `cards` (never writes).
 */
export async function transitionDrillSession(
	userId: string,
	sessionId: string,
	target: DrillSessionTransitionTarget,
): Promise<ApiWeakSpotDrillSessionDetail> {
	const { error } = await supabaseAdmin.rpc("transition_weak_spot_drill_session", asPayload({
		p_user_id: userId,
		p_session_id: sessionId,
		p_target_status: target,
	}));

	if (error !== null) {
		if (error.code === "02000" && error.message.includes("weak_spot_drill_session_not_found")) {
			throw new AppError(404, "Drill session not found", { code: "WEAK_SPOT_DRILL_SESSION_NOT_FOUND" });
		}
		if (error.code === "22000" && error.message.includes("weak_spot_drill_session_state_conflict")) {
			throw new AppError(409, "Drill session cannot be transitioned from its current state", {
				code: "WEAK_SPOT_DRILL_SESSION_STATE_CONFLICT",
			});
		}
		log.error({ sessionId, target, err: { message: error.message, code: error.code } }, "transitionDrillSession RPC failed");
		throw dbError("transition drill session", error);
	}

	// The transition RPC returns void. Fetch the post-state envelope through
	// the same RPC the Stage 4 resume endpoint uses, so the wire shape stays
	// identical and frontends can drop the response into their TanStack Query
	// session-detail cache directly.
	return getDrillSession(userId, sessionId);
}

// ─── WeakSpot diagnosis (Stage 7) ────────────────────────────────────────────────
//
// `POST /api/v1/weak-spots/:id/diagnose` populates a weakSpot's `diagnosis` and
// `prescription` columns with AI-generated text. As of Stage 7 this is a free
// MVP feature (no entitlement gating). Replay-on-existing semantics keep
// OpenAI cost bounded: a weakSpot that already has diagnosis returns the stored
// values without re-calling the model. To regenerate, the client first
// resolves+reopens the weakSpot (which clears the row).

/** Slim card projection used by diagnosis prompt construction. */
