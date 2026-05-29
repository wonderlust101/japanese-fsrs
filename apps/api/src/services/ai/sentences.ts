import type { GeneratedSentences } from "@fsrs-japanese/shared-types";

import { GeneratedSentencesSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, hashInterests, joinInterests, log, readCache } from "./shared.ts";

const SENTENCES_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

// ── Sentences generator helpers ──────────────────────────────────────────────

interface SentencesInputs {
	safeWord: string;
	safeLevel: string;
	safeInterests: string[];
	safeCount: number;
	safeAvoid: string[];
}

function buildSentencesInputs(
	word: string,
	userLevel: string,
	interests: string[],
	count: number,
	avoid: string[],
): SentencesInputs {
	return {
		safeWord: sanitizeForPrompt(word),
		safeLevel: sanitizeForPrompt(userLevel),
		safeInterests: interests.map(s => sanitizeForPrompt(s)),
		safeCount: Math.max(1, Math.min(5, Math.trunc(count))),
		// Sentences the caller already has; the model is told to avoid them and
		// the cache key is namespaced by their hash so each distinct context
		// ("generate more" after adding some) produces fresh output instead of
		// replaying a prior cached batch. Empty avoid keeps the legacy key shape.
		safeAvoid: avoid.map(s => sanitizeForPrompt(s)).filter(s => s.length > 0),
	};
}

function parseSentencesResponse(raw: string | null | undefined): GeneratedSentences {
	if (raw === null || raw === undefined) {
		throw new AppError(502, "OpenAI returned an empty response", { code: "OPENAI_EMPTY_RESPONSE" });
	}
	return GeneratedSentencesSchema.parse(JSON.parse(raw));
}

async function callSentencesGenerator(
	client: NonNullable<typeof openai>,
	inputs: SentencesInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedSentences> {
	let response;
	try {
		response = await client.chat.completions.create({
			model: CHAT_MODEL,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: `You are a Japanese language expert generating natural example sentences for SRS flash cards.
Always respond with valid JSON.
User level: ${inputs.safeLevel}. User interests: ${joinInterests(inputs.safeInterests)}.
Sentences must be natural, level-appropriate, and tied to the user's interests when possible.`,
				},
				{
					role: "user",
					content: `Generate ${inputs.safeCount} fresh example sentences for the Japanese word: ${inputs.safeWord}

Return JSON with this exact shape:
{
  "sentences": [{ "ja": string, "en": string, "furigana": string }]
}

Constraints:
- Provide exactly ${inputs.safeCount} sentences.
- Each "ja" must contain the target word.
- "furigana" should give hiragana readings for kanji compounds in the sentence.
- Vary the grammar pattern across sentences.${
	inputs.safeAvoid.length > 0
		? `\n- Do NOT repeat or closely paraphrase any of these existing sentences:\n${inputs.safeAvoid.map(s => `  • ${s}`).join("\n")}`
		: ""
}`,
				},
			],
		}, { signal });
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateSentences OpenAI request failed");
		throw err;
	}

	return parseSentencesResponse(response.choices[0]?.message.content);
}

/**
 * Generates fresh example sentences for a Japanese word.
 *
 * Cache key: `sentences:{word}:{userLevel}:{interestsHash}:{count}` — shared
 * across users with the same level/interests profile to maximise cache hits.
 * TTL: 7 days.
 */
export async function generateSentences(
	word: string,
	userLevel: string,
	interests: string[],
	count: number,
	avoid: string[] = [],
	opts?: { signal?: AbortSignal },
): Promise<GeneratedSentences> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	const client = openai; // see generateCard for the narrowing rationale.

	const inputs = buildSentencesInputs(word, userLevel, interests, count, avoid);
	const avoidSeg = inputs.safeAvoid.length > 0 ? `:${hashInterests(inputs.safeAvoid)}` : "";
	const cacheKey = `sentences:${inputs.safeWord}:${inputs.safeLevel}:${hashInterests(inputs.safeInterests)}:${inputs.safeCount}${avoidSeg}`;

	const fromCache = await readCache(cacheKey, GeneratedSentencesSchema);
	if (fromCache !== null)
		return fromCache;

	const sentences = await openaiSemaphore.run({ signal: opts?.signal }, () =>
		withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, () =>
			callSentencesGenerator(client, inputs, opts?.signal)));

	await redis.set(cacheKey, JSON.stringify(sentences), { ex: SENTENCES_CACHE_TTL })
		.catch((err: unknown) => {
			log.warn({
				cacheKey,
				err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
			}, "AI cache write failed; result still returned");
		});
	return sentences;
}
