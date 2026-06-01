import type { Profile } from "@fsrs-japanese/shared-types";
import { z } from "zod";

import { redis } from "../db/redis.ts";
import { componentLogger } from "./logger.ts";

/**
 * Redis-backed cache for the user's `Profile`.
 *
 * The summary view fires several independent requests (session-summary,
 * forecast, day-reflection) that each read the profile, and most app reads
 * (`due`, `forecast`, analytics, AI generation) call `getProfile` once per
 * request. Those are separate HTTP requests, so per-request memoization can't
 * dedupe them — a short-lived shared cache does.
 *
 * Mirrors `lib/due-cache.ts`:
 *   - Cache hit serves the exact `Profile` from a prior `getProfileCached`.
 *   - 300s TTL caps staleness for any change that bypasses `updateProfile`.
 *   - `updateProfile` invalidates explicitly so same-service edits show up on
 *     the very next read.
 *   - Failure modes (Redis down / breaker open / corrupt entry) → treated as a
 *     miss; the caller always falls through to the DB. Matches the due-cache /
 *     AI-cache failure-mode convention.
 *
 * NOT used by the settings `GET /profile` or by `updateProfile`'s return: those
 * need the live optimistic-concurrency `version`, so they keep calling the
 * uncached `getProfile`.
 *
 * Key shape: `profile:v1:${userId}`.
 */

const log = componentLogger("profile-cache");

const PROFILE_CACHE_TTL_SECONDS = 300;
const PROFILE_CACHE_VERSION = "v1";

const profileCacheKey = (userId: string): string => `profile:${PROFILE_CACHE_VERSION}:${userId}`;

// Permissive: require `id` so any downstream `profile.id` access stays safe, and
// allow `Profile` to gain fields without invalidating cached entries. The writer
// (`getProfileCached`) only ever stores a validated `Profile`, so the cache
// re-asserts just the minimal invariant and passes the rest through. The version
// prefix is the manual invalidation lever for a breaking shape change.
const CachedProfileSchema = z.looseObject({ id: z.string() });

/**
 * Read a cached `Profile`. Returns null on miss, Redis failure, or a
 * shape-invalid entry (corrupt entries are best-effort deleted so the next
 * call rewrites them).
 */
export async function readProfileCache(userId: string): Promise<Profile | null> {
	const key = profileCacheKey(userId);
	let raw: unknown;
	try {
		raw = await redis.get<unknown>(key);
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "profile cache read failed; treating as miss");
		return null;
	}
	if (raw === null)
		return null;

	try {
		const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
		// The shape was already proven on write; re-assert the minimal invariant
		// and pass through. Cast back to Profile — the loose schema preserves
		// every field.
		return CachedProfileSchema.parse(parsed) as unknown as Profile;
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "corrupt profile cache entry; treating as miss");
		void redis.del(key).catch(() => { /* TTL will reap if del fails */ });
		return null;
	}
}

/**
 * Write a freshly fetched `Profile` to the cache. Fire-and-forget: any failure
 * is logged but never propagates — the source-of-truth response still goes to
 * the caller.
 */
export async function writeProfileCache(userId: string, profile: Profile): Promise<void> {
	try {
		await redis.set(profileCacheKey(userId), JSON.stringify(profile), { ex: PROFILE_CACHE_TTL_SECONDS });
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "profile cache write failed");
	}
}

/**
 * Invalidate a user's cached profile. Called by `updateProfile` so the next
 * read reflects the write immediately. Best-effort: a missed invalidation
 * surfaces as up to 300s of staleness — bounded by the TTL.
 */
export async function invalidateProfileCache(userId: string): Promise<void> {
	try {
		await redis.del(profileCacheKey(userId));
	} catch (err) {
		log.warn({
			userId,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "profile cache invalidation failed");
	}
}
