import { z } from "zod";

import { redis } from "../db/redis.ts";
import { componentLogger } from "./logger.ts";

/**
 * Redis-backed cache for `GET /api/v1/reviews/due` payloads.
 *
 * Lives in its own module to avoid a circular import: `review.service.ts`
 * already depends on `fsrs.service.ts` (for `processReviewBatch`), and the
 * FSRS write paths need to call `invalidateDueCards` after every successful
 * review submit / forget / reschedule. Both sides can depend on this leaf
 * module without forming a cycle.
 *
 * Contract:
 *   - Cache hit serves the EXACT payload from a prior `getDueCards` call.
 *   - 60s TTL caps staleness for ANY mutation path we forget to invalidate
 *     (deck archive, suspend, card create/delete, profile-limit changes…).
 *   - Failure modes: Redis down / breaker open / corrupt entry → treated
 *     as a miss; the call always falls through to the RPC. This matches
 *     the AI / embedding-cache failure-mode convention.
 *
 * Key shape: `due:v1:${userId}`. Profile bits (timezone, daily limits) are
 * deliberately NOT mixed into the key — the 60s TTL absorbs profile changes
 * without bloating the keyspace.
 */

const log = componentLogger("due-cache");

const DUE_CACHE_TTL_SECONDS = 60;
const DUE_CACHE_VERSION = "v1";

const dueCacheKey = (userId: string): string => `due:${DUE_CACHE_VERSION}:${userId}`;

/**
 * Permissive envelope schema. The inner `items` shape is validated upstream
 * by `getDueCards` itself (via `DueCardRpcRowSchema` → `toApiDueCard`), so
 * the cache only re-asserts the *list-envelope* invariants. This insulates
 * the cache against future `ApiDueCard` field additions: a new field on an
 * existing cached entry will pass through `z.unknown()` and reach the wire
 * unchanged.
 */
const DueCacheEnvelopeSchema = z.object({
	items: z.array(z.unknown()),
	nextCursor: z.null(),
	hasMore: z.boolean(),
});

export interface DueCacheEnvelope<T> {
	items: T[];
	nextCursor: null;
	hasMore: boolean;
}

/**
 * Read a cached due-cards payload. Returns null on miss, Redis failure, or
 * a shape-invalid entry (corrupt entries are best-effort deleted so the
 * next call rewrites them).
 */
export async function readDueCache<T>(userId: string): Promise<DueCacheEnvelope<T> | null> {
	const key = dueCacheKey(userId);
	let raw: unknown;
	try {
		raw = await redis.get<unknown>(key);
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "due cache read failed; treating as miss");
		return null;
	}
	if (raw === null)
		return null;

	try {
		const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
		const result = DueCacheEnvelopeSchema.parse(parsed);
		// items are passed through unchanged. The caller already proved the
		// shape via Zod on the RPC-path write, and the version prefix
		// protects against breaking shape drift.
		return { items: result.items as T[], nextCursor: null, hasMore: result.hasMore };
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "corrupt due cache entry; treating as miss");
		void redis.del(key).catch(() => { /* TTL will reap if del fails */ });
		return null;
	}
}

/**
 * Write a freshly computed due-cards payload to the cache. Fire-and-forget:
 * any failure is logged but never propagates — the source-of-truth response
 * still goes to the user.
 */
export async function writeDueCache<T>(userId: string, payload: DueCacheEnvelope<T>): Promise<void> {
	try {
		await redis.set(dueCacheKey(userId), JSON.stringify(payload), { ex: DUE_CACHE_TTL_SECONDS });
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "due cache write failed");
	}
}

/**
 * Invalidate a user's cached due list. Called by FSRS write paths
 * (processReview, processReviewBatch, forgetCard, rescheduleFromHistory)
 * so the next session-start fetch always sees the up-to-date set.
 *
 * Best-effort: any failure is logged. A missed invalidation surfaces as
 * up to 60s of staleness — bounded by the TTL.
 */
export async function invalidateDueCache(userId: string): Promise<void> {
	try {
		await redis.del(dueCacheKey(userId));
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "due cache invalidation failed");
	}
}
