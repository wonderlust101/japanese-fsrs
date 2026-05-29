import type { GeneratedSentenceCard } from "@fsrs-japanese/shared-types";

import { GeneratedSentenceCardSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, hashInterests, joinInterests, log, readCache } from "./shared.ts";

// Backend Completion Plan Stage 13. Mirror of CARD_PROMPT_VERSION for the
// sentence-layout branch. Lives separately so the sentence prompt can
// version-bump independently of the vocabulary prompt — same Redis cache
// key invalidation pattern, different namespace (`sentence-card:vN:…`).
// Bumped to 'v2' when the sentence-layout `audio` field was removed from
// the model and its "do not invent audio" prompt line dropped.
const SENTENCE_CARD_PROMPT_VERSION = "v2";

// Sentence cards live on the same 7-day TTL as vocabulary cards (per
// TDD §10.1). The cache key already discriminates by version + topic +
// learner level + interests; a long TTL just delays the natural eviction.
const SENTENCE_CARD_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Generates structured sentence-card content for a topic / seed word.
 * Backend Completion Plan Stage 13 — pairs with the Stage 12 schema +
 * CHECK tightening on sentence-layout cards.
 *
 * Cache key: `sentence-card:{version}:{topic}:{userLevel}:{interestsHash}` —
 * separate namespace from `card:…` (vocabulary) so the two prompts can
 * version-bump independently. TTL: 7 days per TDD §10.1.
 *
 * Output shape matches `SentenceFieldsDataSchema` admitted by Stage 12:
 * required `ja` / `en` / `furigana`; optional `breakdown` (token-level
 * annotation) and `nuance` (short prose on register / pragmatics).
 *
 * Throws AppError(502) if OpenAI returns an empty response.
 * Throws ZodError if the response shape does not match
 * `GeneratedSentenceCardSchema`.
 */
export async function generateSentenceCard(
	topic: string,
	userLevel: string,
	interests: string[],
	opts?: { signal?: AbortSignal },
): Promise<GeneratedSentenceCard> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	const client = openai; // see generateCard for the narrowing rationale.

	const safeTopic = sanitizeForPrompt(topic);
	const safeLevel = sanitizeForPrompt(userLevel);
	const safeInterests = interests.map(s => sanitizeForPrompt(s));

	// Distinct namespace from `card:…` (vocabulary). Prompt-version segment
	// mirrors the CARD_PROMPT_VERSION / DIAGNOSIS_PROMPT_VERSION pattern.
	const cacheKey = `sentence-card:${SENTENCE_CARD_PROMPT_VERSION}:${safeTopic}:${safeLevel}:${hashInterests(safeInterests)}`;

	const fromCache = await readCache(cacheKey, GeneratedSentenceCardSchema);
	if (fromCache !== null)
		return fromCache;

	const sentenceCard = await openaiSemaphore.run({ signal: opts?.signal }, () => withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, async () => {
		let response;
		try {
			response = await client.chat.completions.create({
				model: CHAT_MODEL,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content: `You are a Japanese language expert authoring example-sentence SRS cards.
Always respond with valid JSON.
User level: ${safeLevel}. User interests: ${joinInterests(safeInterests)}.
Sentence content must be natural, level-appropriate, and lean on the user's interests when possible. The sentence is the headline content — it is not a side example; it is the card.`,
					},
					{
						role: "user",
						content: `Generate one example-sentence card for the topic or seed phrase: ${safeTopic}

Return JSON with these keys:
{
  "ja":        string (one natural Japanese sentence using kanji + kana as a learner at ${safeLevel} would actually see it),
  "en":        string (English gloss — a translation that captures the sentence's register, not a word-for-word transliteration),
  "furigana":  string (hiragana annotation for the kanji in the sentence; readings only — keep particles and hiragana characters identical to "ja"),
  "breakdown": [{ "token": string, "reading"?: string, "meaning"?: string }] (optional; one entry per content-bearing token. Particles and punctuation may omit reading + meaning. Skip entirely if the sentence is too short to benefit from breakdown.),
  "nuance":    string (optional; 1–2 sentences on register / pragmatics — what makes this sentence noteworthy. Omit if there is nothing distinctive to say.)
}`,
					},
				],
			}, { signal: opts?.signal });
		} catch (err) {
			log.error({
				err: {
					name: err instanceof Error ? err.name : "Unknown",
					message: scrubKeyish(err),
				},
			}, "generateSentenceCard OpenAI request failed");
			throw err;
		}

		const raw = response.choices[0]?.message.content;
		if (raw === null || raw === undefined) {
			throw new AppError(502, "OpenAI returned an empty response", { code: "OPENAI_EMPTY_RESPONSE" });
		}
		return GeneratedSentenceCardSchema.parse(JSON.parse(raw));
	}));

	await redis.set(cacheKey, JSON.stringify(sentenceCard), { ex: SENTENCE_CARD_CACHE_TTL })
		.catch((err: unknown) => {
			log.warn({
				cacheKey,
				err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
			}, "AI cache write failed; result still returned");
		});
	return sentenceCard;
}
