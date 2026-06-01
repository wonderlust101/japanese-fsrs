import type OpenAI from "openai";
import type { ZodType } from "zod";

import { createHash } from "node:crypto";
import { redis } from "../../db/redis.ts";
import { env } from "../../lib/env.ts";
import { componentLogger } from "../../lib/logger.ts";
import { TIMEOUTS } from "../../lib/timeouts.ts";
import { AppError } from "../../middleware/errorHandler.ts";

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

// Model for the *structured/factual* generators (card, diagnosis) where the
// cost of a wrong reading / POS / pitch / kanji breakdown outweighs the price
// of a stronger model. Falls back to the general chat model when
// OPENAI_CHAT_MODEL_STRUCTURED is unset, so a single-model deploy needs zero
// extra config and behaviour is unchanged.
export const CHAT_MODEL_STRUCTURED = env.OPENAI_CHAT_MODEL_STRUCTURED ?? env.OPENAI_CHAT_MODEL;

// Temperature policy. Structured/factual generators (card, sentence-card,
// diagnosis) run cold for run-to-run consistency — these have one correct
// answer and high temperature is just injected noise. Creative generators
// (sentences, mnemonic, tomo-note, day-reflection) run warm so output stays
// varied day to day. Centralised so the policy is visible in one place and
// assertable in tests.
export const STRUCTURED_TEMPERATURE = 0.3;
export const CREATIVE_TEMPERATURE = 0.8;

// Fixed seed for the structured generators. OpenAI treats `seed` as
// best-effort, but paired with the low temperature above it makes a
// regeneration after a cache miss far more reproducible for identical inputs.
// Creative generators intentionally omit it so warmth produces fresh output.
export const STRUCTURED_SEED = 1729;

/**
 * Per-request OpenAI options for *advisory* generators (day-reflection,
 * weak-spot diagnosis) that have an instant fallback and front a
 * latency-sensitive surface (the review-summary closing screen). Spread into
 * the `chat.completions.create(..., { signal, ...ENHANCEMENT_REQUEST_OPTS })`
 * call so it overrides the client-wide 15s / 2-retry defaults from
 * lib/openai.ts with a tighter 8s / 1-retry budget (~16s worst case instead
 * of ~30s). See `TIMEOUTS.openaiEnhancementCall` for the full rationale.
 */
export const ENHANCEMENT_REQUEST_OPTS = {
	timeout: TIMEOUTS.openaiEnhancementCall,
	maxRetries: 1,
} as const;

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

// The second argument to the SDK's `create(...)` — per-call signal plus the
// tighter timeout/retry budget from ENHANCEMENT_REQUEST_OPTS. Derived from the
// SDK signature itself so it stays exactly compatible under
// `exactOptionalPropertyTypes` (a hand-rolled interface fought the SDK's
// stricter `maxRetries: number`).
export type ChatRequestOptions = Parameters<OpenAI["chat"]["completions"]["create"]>[1];

function tryParse<T>(
	raw: string | null | undefined,
	schema: ZodType<T>,
): { ok: true; value: T } | { ok: false; reason: string } {
	if (raw === null || raw === undefined)
		return { ok: false, reason: "empty response" };
	try {
		return { ok: true, value: schema.parse(JSON.parse(raw)) };
	} catch (err) {
		// Cap the reason so a huge ZodError doesn't bloat the repair prompt or logs.
		return { ok: false, reason: (err instanceof Error ? err.message : String(err)).slice(0, 300) };
	}
}

/**
 * Run a chat-completion and validate its JSON against `schema`, with ONE repair
 * attempt if the first response is empty or fails validation. The repair turn
 * echoes the bad output and the validation reason back to the model and asks
 * for corrected JSON only.
 *
 * For STRUCTURED generators (card / sentence-card / diagnosis) only. Must be
 * called from inside the `withBreaker(...)` closure: a Zod/JSON failure would
 * otherwise escape as a raw error that withBreaker counts as an infra failure
 * against the chat breaker. A final give-up here throws `AppError(502)`, which
 * the breaker deliberately does NOT count (see lib/circuit-breaker.ts) — a
 * model that returns malformed JSON twice is a content problem, not an outage.
 *
 * Throws `OPENAI_EMPTY_RESPONSE` if both attempts returned empty content, or
 * `OPENAI_MALFORMED_RESPONSE` if the repaired output still failed validation.
 */
export async function parseWithRepair<T>(
	client: OpenAI,
	params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
	requestOpts: ChatRequestOptions,
	schema: ZodType<T>,
	label: string,
): Promise<T> {
	const first = await client.chat.completions.create(params, requestOpts);
	const firstRaw = first.choices[0]?.message.content;
	const firstAttempt = tryParse(firstRaw, schema);
	if (firstAttempt.ok)
		return firstAttempt.value;

	log.warn({ label, reason: firstAttempt.reason }, "structured output failed validation; attempting one repair");
	const repair = await client.chat.completions.create({
		...params,
		messages: [
			...params.messages,
			{ role: "assistant", content: firstRaw ?? "" },
			{
				role: "user",
				content: `That response was not valid (${firstAttempt.reason}). Reply with ONLY corrected JSON that exactly matches the requested shape — no prose, no markdown fences.`,
			},
		],
	}, requestOpts);
	const repairRaw = repair.choices[0]?.message.content;
	const repairAttempt = tryParse(repairRaw, schema);
	if (repairAttempt.ok)
		return repairAttempt.value;

	if (repairRaw === null || repairRaw === undefined)
		throw new AppError(502, "OpenAI returned an empty response", { code: "OPENAI_EMPTY_RESPONSE" });
	throw new AppError(502, "OpenAI returned malformed structured output after one repair", { code: "OPENAI_MALFORMED_RESPONSE" });
}
