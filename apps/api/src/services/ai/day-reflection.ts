import type { GeneratedTomoNote } from "@fsrs-japanese/shared-types";

import { GeneratedTomoNoteSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, ENHANCEMENT_REQUEST_OPTS, log, readCache } from "./shared.ts";

// Day reflection (post-session AI note over the user's local-day aggregate
// of reviews). Versioned independently of the morning Tomo note so the two
// prompts can evolve separately. Cache key namespace: `reflection:vN:…`.
//
// v2 (audit remediation): added a conditional "short session" clause in
// the user-message body when totalCards < 5, so the AI acknowledges brief
// sessions explicitly rather than silently producing a generic line. The
// version bump invalidates every cached v1 entry on deploy; cost spike is
// one regeneration per active user per day.
const REFLECTION_PROMPT_VERSION = "v2";
const REFLECTION_CACHE_TTL = 60 * 60 * 36;

// In-process single-flight for concurrent identical generations (keyed by the
// Redis cacheKey). Collapses the summary-page read + the session-close precompute
// race into one OpenAI call. Entries are short-lived: added on a cache miss and
// removed the moment the generation settles.
const inFlightReflections = new Map<string, Promise<GeneratedTomoNote>>();

interface DayReflectionInput {
	userId: string;
	dateKey: string;
	/**
	 * SHA-256-derived fingerprint of the day's session-ID set. New session
	 *  same day → new fingerprint → cache miss → fresh generation that
	 *  incorporates the just-finished session's data.
	 */
	fingerprint: string;
	userLevel: string;
	nativeLanguage: string;
	totalCards: number;
	totalTimeMs: number;
	accuracyPct: number;
	breakdown: { again: number; hard: number; good: number; easy: number };
	sessionCount: number;
	weakSpotWords: string[];
}

// ── Day-reflection generator helpers ─────────────────────────────────────────

interface DayReflectionPromptInputs {
	safeLevel: string;
	safeNative: string;
	safeDate: string;
	safeFinger: string;
	totalCards: number;
	accuracyPct: number;
	minutes: number;
	sessionPhrase: string;
	breakdownPhrase: string;
	weakSpotPhrase: string;
	shortSessionPhrase: string;
}

function buildDayReflectionPromptInputs(input: DayReflectionInput): DayReflectionPromptInputs {
	const minutes = Math.max(1, Math.round(input.totalTimeMs / 60_000));
	const sessionPhrase = input.sessionCount === 1
		? "1 session"
		: `${input.sessionCount} sessions`;
	const breakdownPhrase = `Ratings: Again ${input.breakdown.again}, Hard ${input.breakdown.hard}, Good ${input.breakdown.good}, Easy ${input.breakdown.easy}.`;
	const weakSpotPhrase = input.weakSpotWords.length > 0
		? `Weak spots that surfaced today: ${input.weakSpotWords.join(", ")}.`
		: "No weak spots surfaced today.";
	// Short-session acknowledgement (audit-remediation v2). Mirrors the
	// editorial framing that the deterministic frontend prose had before
	// the aside slot was removed from the Session details card.
	const shortSessionPhrase = input.totalCards < 5
		? "\nNote: this was a short session, not enough cards to read a clear pattern. A brief, honest reflection is fine."
		: "";

	return {
		safeLevel: sanitizeForPrompt(input.userLevel),
		safeNative: sanitizeForPrompt(input.nativeLanguage),
		safeDate: sanitizeForPrompt(input.dateKey),
		safeFinger: sanitizeForPrompt(input.fingerprint),
		totalCards: input.totalCards,
		accuracyPct: input.accuracyPct,
		minutes,
		sessionPhrase,
		breakdownPhrase,
		weakSpotPhrase,
		shortSessionPhrase,
	};
}

function parseDayReflectionResponse(raw: string | null | undefined): GeneratedTomoNote {
	if (raw === null || raw === undefined) {
		throw new AppError(502, "OpenAI returned an empty response", { code: "OPENAI_EMPTY_RESPONSE" });
	}
	return GeneratedTomoNoteSchema.parse(JSON.parse(raw));
}

async function callDayReflectionGenerator(
	client: NonNullable<typeof openai>,
	inputs: DayReflectionPromptInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedTomoNote> {
	let response;
	try {
		response = await client.chat.completions.create({
			model: CHAT_MODEL,
			response_format: { type: "json_object" },
			// The output is a single { "body": string } under 220 chars (~60-70
			// tokens). Capping completion tokens bounds tail latency on this
			// closing-screen call without touching the 8s timeout (which would
			// otherwise abort the ~3s successful generation into fallback prose).
			// 256 leaves generous headroom for the JSON envelope so the body is
			// never truncated below GeneratedTomoNoteSchema's expectations.
			max_completion_tokens: 256,
			messages: [
				{
					role: "system",
					content: `Role:
You are Tomo, a calm English-speaking tutor for learners of Japanese.

Task:
Write one short prose reflection for the learner AFTER their day of review practice.

Context:
The learner is studying Japanese.
Learner level: ${inputs.safeLevel}.
Native language: ${inputs.safeNative}.

Goal:
Help the learner notice one small, useful thing about today's practice.
The reflection should feel like a thoughtful tutor closing the day's work with one grounded observation, drawn from the practice data.

Constraints:
- The JSON value "body" MUST be written in English.
- Do not write Japanese sentences in body.
- You may include Japanese words only as brief quoted examples when useful, drawn from the weak-spot list when present.
- Keep body under 220 characters.
- Write one observation or one micro-suggestion grounded in the day's practice.
- Refer to the day that just happened, not to tomorrow.
- Do not write a list.
- Do not greet.
- Do not sign off.
- Do not mention AI.
- Do not apologize for being a model.

Voice:
Quiet, warm, and grounded.
Closing-the-day register: reflective, not anticipatory.
Kind, but not perky.
Encouraging, but not motivational-poster.
Specific rather than generic.
Use plain, natural English.

Format:
Always respond with valid JSON.
Return JSON with this exact shape:
{ "body": string }

Quality bar:
The reflection should sound like a tutor noticing something real from today's work.
Prefer concrete noticing over praise.
Prefer gentle direction over encouragement.
The learner should feel seen, not managed.`,
				},
				{
					role: "user",
					content: `Today's practice:
${inputs.sessionPhrase} totaling ${inputs.totalCards} cards in ~${inputs.minutes} minutes.
Overall accuracy: ${inputs.accuracyPct}%.
${inputs.breakdownPhrase}
${inputs.weakSpotPhrase}${inputs.shortSessionPhrase}

Write one reflective English note based on today's practice.

Return JSON with this exact shape:
{ "body": string }`,
				},
			],
		}, { signal, ...ENHANCEMENT_REQUEST_OPTS });
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateDayReflection OpenAI request failed");
		throw err;
	}

	return parseDayReflectionResponse(response.choices[0]?.message.content);
}

/**
 * Generates one short Tomo-voice reflection on the learner's day of review
 * practice. Mirrors `generateTomoNote`'s shape but lives in the
 * closing-the-day register: reflective, not anticipatory.
 *
 * Cache key: `reflection:{REFLECTION_PROMPT_VERSION}:{userId}:{dateKey}:
 * {fingerprint}`. The fingerprint is the load-bearing detail — it lets a
 * new same-day session naturally bypass the previous cache entry and
 * regenerate with the day's full aggregate.
 *
 * Returns the same `GeneratedTomoNote` shape (`{ body }`) since the wire
 * model is identical. Callers wrap with their own `source: 'ai' | 'fallback'`
 * tag at the service boundary.
 */
export async function generateDayReflection(
	input: DayReflectionInput,
	opts?: { signal?: AbortSignal },
): Promise<GeneratedTomoNote> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	const client = openai;

	const inputs = buildDayReflectionPromptInputs(input);
	const cacheKey = `reflection:${REFLECTION_PROMPT_VERSION}:${input.userId}:${inputs.safeDate}:${inputs.safeFinger}`;

	const fromCache = await readCache(cacheKey, GeneratedTomoNoteSchema);
	if (fromCache !== null)
		return fromCache;

	// Single-flight: a freshly-finished session triggers two near-simultaneous
	// reads for the same reflection — the summary page's day-reflection query and
	// the server-side session-close precompute. Both miss the Redis cache (it's
	// not written until generation finishes), so without coordination each spends
	// its own OpenAI generation. Share one in-flight promise per cacheKey so the
	// second caller awaits the first instead of double-spending the AI quota.
	const existing = inFlightReflections.get(cacheKey);
	if (existing !== undefined)
		return existing;

	const pending = (async (): Promise<GeneratedTomoNote> => {
		const reflection = await openaiSemaphore.run({ signal: opts?.signal }, () =>
			withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, () =>
				callDayReflectionGenerator(client, inputs, opts?.signal)));

		await redis.set(cacheKey, JSON.stringify(reflection), { ex: REFLECTION_CACHE_TTL })
			.catch((err: unknown) => {
				log.warn({
					cacheKey,
					err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
				}, "AI cache write failed; result still returned");
			});
		return reflection;
	})();

	inFlightReflections.set(cacheKey, pending);
	try {
		return await pending;
	} finally {
		// Clear the slot once settled (success or failure) so a later read after a
		// failed generation retries fresh rather than replaying the rejection.
		inFlightReflections.delete(cacheKey);
	}
}
