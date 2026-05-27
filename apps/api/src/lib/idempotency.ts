import { createHash } from "node:crypto";
import { z } from "zod";

import { supabaseAdmin } from "../db/supabase.ts";
import { AppError } from "../middleware/errorHandler.ts";
import { asPayload } from "./db.ts";
import { componentLogger } from "./logger.ts";

const log = componentLogger("idempotency");

/**
 * Wraps a state-mutating handler in a per-user replay store, so a network-blip
 * retry from the offline queue (or a manually re-fired request) returns the
 * original response instead of re-running the side effects.
 *
 * Storage lives in `idempotency_keys` (migration 20260524000000):
 *   - PK on (user_id, key) — per-user scope; cross-user collision impossible.
 *   - 24h TTL — lazy cleanup runs on every claim.
 *   - Three SECURITY DEFINER RPCs handle the atomic claim / store / delete steps.
 *
 * Behaviour:
 *   - Header missing → 400.
 *   - Header malformed (non-UUID) → 400.
 *   - Same key + same body → return the stored response (replay).
 *   - Same key + different body → 422 (semantic conflict).
 *   - Same key, prior call still processing → 409 (caller retries shortly).
 *   - Fresh key → run worker, store {status, body}, return.
 *
 * On worker failure:
 *   - AppError → store the error response so retries replay the same error.
 *   - Anything else → delete the placeholder so retries can succeed once
 *     transient infrastructure failures clear.
 */

const idempotencyKeySchema = z.string().uuid("Idempotency-Key must be a UUID");

const ClaimRowSchema = z.object({
	status: z.enum(["fresh", "replay", "conflict", "in_flight"]),
	stored_status: z.number().nullable(),
	stored_body: z.unknown(),
});

type ClaimRow = z.infer<typeof ClaimRowSchema>;

export interface IdempotencyResult<T> {
	status: number;
	body: T;
}

export async function withIdempotency<T>(
	userId: string,
	rawHeader: string | undefined,
	requestPayload: unknown,
	worker: () => Promise<IdempotencyResult<T>>,
): Promise<IdempotencyResult<T>> {
	if (rawHeader === undefined) {
		throw new AppError(400, "Idempotency-Key header is required", { code: "IDEMPOTENCY_KEY_REQUIRED" });
	}

	const keyResult = idempotencyKeySchema.safeParse(rawHeader);
	if (!keyResult.success) {
		throw new AppError(400, "Idempotency-Key must be a UUID", { code: "IDEMPOTENCY_KEY_INVALID" });
	}
	const key = keyResult.data;

	// Hash the parsed payload (after Zod normalization) so equivalent bodies
	// with different whitespace / key ordering still match.
	const requestHash = createHash("sha256")
		.update(JSON.stringify(requestPayload))
		.digest("hex");

	const { data, error } = await supabaseAdmin.rpc("claim_idempotency_key", asPayload({
		p_user_id: userId,
		p_key: key,
		p_request_hash: requestHash,
	}));

	if (error !== null) {
		log.error({ err: { name: error.message, code: error.code } }, "claim failed");
		throw new AppError(500, "Failed to claim idempotency key", { code: "IDEMPOTENCY_CLAIM_FAILED" });
	}

	const rows = z.array(ClaimRowSchema).parse(data ?? []);
	const claim: ClaimRow = rows[0] ?? { status: "fresh", stored_status: null, stored_body: null };

	if (claim.status === "conflict") {
		throw new AppError(422, "Idempotency-Key reused with a different request body", { code: "IDEMPOTENCY_KEY_CONFLICT" });
	}
	if (claim.status === "in_flight") {
		throw new AppError(409, "Idempotent request already in flight; please retry shortly", { code: "IDEMPOTENCY_IN_FLIGHT" });
	}
	if (claim.status === "replay") {
		return {
			status: claim.stored_status ?? 200,
			body: claim.stored_body as T,
		};
	}

	// Fresh — run the worker.
	let result: IdempotencyResult<T>;
	try {
		result = await worker();
	} catch (err) {
		// 4xx semantic errors are deterministic for the same input and SHOULD
		// replay (validation, auth, not-found, conflict). Store the response.
		if (err instanceof AppError && err.statusCode < 500) {
			const errBody = { error: err.message };
			const { error: storeError } = await supabaseAdmin.rpc("store_idempotency_response", asPayload({
				p_user_id: userId,
				p_key: key,
				p_status: err.statusCode,
				p_body: errBody,
			}));
			if (storeError !== null) {
				log.error({ err: storeError }, "store on 4xx AppError failed");
			}
			throw err;
		}
		// 5xx AppError or non-AppError = transient. Release the placeholder so
		// retries claim afresh once the underlying issue clears. Without this,
		// a 503 from the OpenAI circuit breaker would be cached for 24h and
		// block legitimate retries after the upstream recovers.
		const { error: delError } = await supabaseAdmin.rpc("delete_idempotency_key", asPayload({
			p_user_id: userId,
			p_key: key,
		}));
		if (delError !== null) {
			log.error({ err: delError }, "delete on 5xx/transient failed");
		}
		throw err;
	}

	// Success — persist the response for replay.
	const { error: storeError } = await supabaseAdmin.rpc("store_idempotency_response", asPayload({
		p_user_id: userId,
		p_key: key,
		p_status: result.status,
		p_body: result.body,
	}));
	if (storeError !== null) {
		// The work already committed; log and continue. Subsequent retries will
		// hit 'in_flight' until expiry, but the original response went out.
		log.error({ err: storeError }, "store on success failed");
	}

	return result;
}
