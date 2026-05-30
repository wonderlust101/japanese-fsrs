import type { User } from "@supabase/supabase-js";
import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";

import { redis } from "../db/redis.ts";
import { supabaseAdmin } from "../db/supabase.ts";
import { env } from "../lib/env.ts";
import { componentLogger } from "../lib/logger.ts";
import { AppError } from "./errorHandler.ts";

const log = componentLogger("auth.middleware");

interface CacheEntry { user: User; expiresAt: number }

// ─── L2 (Redis) token cache ───────────────────────────────────────────────────
// L1 (the in-process Map below) handles same-pod repeat auth in <1ms. L2
// extends caching across pods: when pod A verifies a token and pod B serves the
// user's next request before either L1 entry refreshes, B reads from Redis
// instead of hitting Supabase auth again.
//
// Staleness note: L2 is written ONLY on a full Supabase verification (never
// refreshed on an L2 hit), so the chain can't extend indefinitely. But a late-
// life L2 read can seed a fresh 30s L1 entry on another pod, so the FLEET-WIDE
// worst case for a revoked token is up to ~2×TTL (~60s), not a flat 30s.
//
// Gated by NODE_ENV !== 'test' so the existing auth.middleware.test.ts suite
// (which mocks supabaseAdmin but not redis) keeps passing without changes.
// Mirrors the RATE_LIMITING_ENABLED pattern at middleware/rateLimit.ts.
//
// Version prefix gives a manual invalidation lever — bump if the cached
// shape stops being a User-compatible object.
const TOKEN_L2_TTL_SECONDS = 30;
const TOKEN_L2_VERSION = "v1";
const L2_ENABLED = env.NODE_ENV !== "test";

const l2Key = (tokenHash: string): string => `auth:${TOKEN_L2_VERSION}:${tokenHash}`;

// Permissive shape: require `id` so downstream req.user.id is always safe;
// allow Supabase to add fields without invalidating cached entries.
const CachedUserSchema = z.looseObject({ id: z.string() });

/**
 * Per-process in-memory cache for verified bearer tokens. Keyed by SHA-256 of
 * the raw token so the JWT itself never lives on the heap as a Map key.
 *
 * TTL of 30 seconds bounds the per-process staleness window: a token revoked in
 * Supabase remains accepted by THIS process for up to 30s. Across pods the worst
 * case is ~2×TTL (~60s) — see the L2 staleness note above. Acceptable trade-off
 * for the latency win — typical session lifetimes are ~1h and revocations are rare.
 *
 * Bounded at 5000 entries (~ 5000 unique active tokens × ~200B = ~1MB) to keep
 * the cache from growing unbounded under abuse. Eviction drops the oldest
 * insertion (Map iteration order) — adequate for an L1 cache; not a true LRU.
 *
 * Failure-mode interaction with the Supabase circuit breaker: cached entries
 * serve their TTL even when the breaker is open. The fall-through path (cache
 * miss + open breaker) still 503s, so the cache only ever *improves* tail
 * behaviour during outages — it never masks them.
 */
const TOKEN_CACHE_TTL_MS = 30_000;
const TOKEN_CACHE_MAX = 5000;
const tokenCache = new Map<string, CacheEntry>();

function pruneIfTooLarge(): void {
	if (tokenCache.size <= TOKEN_CACHE_MAX)
		return;
	const oldestKey = tokenCache.keys().next().value;
	if (oldestKey !== undefined)
		tokenCache.delete(oldestKey);
}

/**
 * Test-only escape hatch. Lets unit tests reset cache state between cases so
 * a stub `auth.getUser()` doesn't get bypassed by a leftover entry. Underscore
 * prefix marks it as internal; production code never calls it.
 */
export function _clearTokenCacheForTests(): void {
	tokenCache.clear();
}

/**
 * Verifies the Supabase JWT in the Authorization header and attaches the
 * authenticated user to req.user. Must be applied to every protected route.
 *
 * Cache: a SHA-256 hash of the bearer token keys a 30s in-memory entry holding
 * the verified user object. On hit the upstream `auth.getUser` call is
 * skipped — this is the hot-path optimization for high-RPM clients. On miss
 * the standard Supabase verification runs and the result is cached.
 *
 * Returns 401 when:
 *   - The Authorization header is missing or not in Bearer format
 *   - The token has expired or is otherwise invalid
 */
export const authMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
	try {
		const authHeader = req.headers.authorization;

		if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
			throw new AppError(401, "Missing or malformed Authorization header", { code: "AUTH_HEADER_MISSING" });
		}

		const token = authHeader.slice("Bearer ".length);

		// Hash, not raw token, lives in the Map key. SHA-256 is sufficient for
		// collision resistance at this scale; cryptographic strength isn't
		// required since the cache is a process-local optimization.
		const tokenHash = createHash("sha256").update(token).digest("hex");
		const cached = tokenCache.get(tokenHash);
		if (cached !== undefined && Date.now() < cached.expiresAt) {
			req.user = cached.user;
			next();
			return;
		}

		// ── L2 (Redis) lookup on L1 miss ─────────────────────────────────────────
		// Any failure (network, breaker open, corrupt entry) falls through to the
		// Supabase call below — L2 only ever speeds things up, never gates them.
		if (L2_ENABLED) {
			const l2User = await readL2Token(tokenHash);
			if (l2User !== null) {
				tokenCache.set(tokenHash, { user: l2User, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
				pruneIfTooLarge();
				req.user = l2User;
				next();
				return;
			}
		}

		const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

		if (error !== null || user === null) {
			throw new AppError(401, "Invalid or expired token", { code: "AUTH_TOKEN_INVALID" });
		}

		tokenCache.set(tokenHash, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
		pruneIfTooLarge();
		if (L2_ENABLED) {
			// Fire-and-forget: the response must not wait on Redis. A failed write
			// just means the next cross-pod request will pay one more Supabase call.
			void writeL2Token(tokenHash, user);
		}
		req.user = user;
		next();
	} catch (err) {
		next(err);
	}
};

/**
 * Read a cached User from L2 (Redis). Returns null on miss, on Redis failure
 * (network, upstash breaker open), or on a corrupt entry (shape drift). On
 * corrupt entries the bad key is best-effort deleted.
 */
async function readL2Token(tokenHash: string): Promise<User | null> {
	const key = l2Key(tokenHash);
	let raw: unknown;
	try {
		raw = await redis.get<unknown>(key);
	} catch (err) {
		log.warn({
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "L2 token cache read failed; treating as miss");
		return null;
	}
	if (raw === null)
		return null;

	try {
		const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
		const result = CachedUserSchema.safeParse(parsed);
		if (!result.success)
			throw new Error("cached user failed shape check");
		// Cast back to the SDK User type: the loose schema preserves all fields,
		// so downstream `req.user.id`/`.email` access continues to work. If the
		// Supabase User type ever drifts in a breaking way, the version prefix
		// is the manual invalidation lever.
		return result.data as unknown as User;
	} catch (err) {
		log.warn({
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "corrupt L2 token cache entry; treating as miss");
		void redis.del(key).catch(() => { /* swallow — entry will TTL out */ });
		return null;
	}
}

/**
 * Write a freshly verified User to L2. Fire-and-forget: any failure is
 * logged but never propagates — the L1 Map remains the same-process source
 * of truth, and the next cross-pod miss falls back to Supabase auth.
 */
async function writeL2Token(tokenHash: string, user: User): Promise<void> {
	try {
		await redis.set(l2Key(tokenHash), JSON.stringify(user), { ex: TOKEN_L2_TTL_SECONDS });
	} catch (err) {
		log.warn({
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "L2 token cache write failed");
	}
}
