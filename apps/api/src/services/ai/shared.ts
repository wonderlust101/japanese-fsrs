import type { ZodType } from "zod";

import { createHash } from "node:crypto";
import { redis } from "../../db/redis.ts";
import { env } from "../../lib/env.ts";
import { componentLogger } from "../../lib/logger.ts";

/**
 * Shared breaker namespace for chat-completion calls (card / sentences / mnemonic
 *  all hit the same OpenAI completions backend, so one shared breaker is correct).
 */
export const CHAT_BREAKER = "openai-chat";

/**
 * Single user-facing 503 message for all AI degradation paths (open breaker
 *  or inline failure). Per-failure-mode messages don't help the end user — they
 *  just need "retry shortly." Diagnostic specifics live in server logs.
 */
export const CHAT_UNAVAILABLE_MSG = "AI service temporarily unavailable; please retry shortly";

export const log = componentLogger("ai.service");

// `openai` is the shared OpenAI client from lib/openai.ts — same instance
// used by card.service.ts for embeddings. Null when OPENAI_API_KEY is unset.
export const CHAT_MODEL = env.OPENAI_CHAT_MODEL;

// Hard cap on the joined interests fragment when it lands in a prompt — even
// 20 individually-bounded interests can produce a 1KB+ string that crowds out
// the actual instruction text.
const PROMPT_INTERESTS_MAX = 500;

export function joinInterests(interests: string[]): string {
	return interests.join(", ").slice(0, PROMPT_INTERESTS_MAX);
}

export function hashInterests(interests: string[]): string {
	return createHash("sha256")
		.update(JSON.stringify([...interests].sort()))
		.digest("hex")
		.slice(0, 16);
}

/**
 * Read + validate a cached AI payload. Returns null on miss OR on a corrupt
 * cache entry — a parse / Zod failure logs WARN, deletes the bad key, and
 * falls through to a fresh OpenAI call. Without this guard a single bad
 * write (write-truncation, schema drift) would surface as a 500 to every
 * subsequent request that hashes to the same key until TTL.
 */
export async function readCache<T>(cacheKey: string, schema: ZodType<T>): Promise<T | null> {
	// Cache is OPTIONAL — Upstash failures must not break the AI request path.
	// A `redis.get` throw (e.g., breaker open from sustained Upstash issues)
	// surfaces here; we log warn and return null so the caller falls through
	// to the fresh OpenAI fetch.
	let cached: unknown;
	try {
		cached = await redis.get<unknown>(cacheKey);
	} catch (err) {
		log.warn({
			cacheKey,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "AI cache read failed; treating as miss");
		return null;
	}
	if (cached === null)
		return null;
	try {
		const payload = typeof cached === "string" ? JSON.parse(cached) : cached;
		return schema.parse(payload);
	} catch (err) {
		log.warn({
			cacheKey,
			err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
		}, "corrupt AI cache entry; treating as miss");
		// Best-effort delete; if the del also fails (e.g. same Upstash issue),
		// the corrupt entry will eventually TTL out — don't fail the request.
		await redis.del(cacheKey).catch(() => undefined);
		return null;
	}
}
