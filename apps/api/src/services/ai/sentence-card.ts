import type { GeneratedSentenceCard } from "@fsrs-japanese/shared-types";

import { GeneratedSentenceCardSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, hashInterests, joinInterests, log, parseWithRepair, readCache, STRUCTURED_SEED, STRUCTURED_TEMPERATURE } from "./shared.ts";

// Backend Completion Plan Stage 13. Mirror of CARD_PROMPT_VERSION for the
// sentence-layout branch. Lives separately so the sentence prompt can
// version-bump independently of the vocabulary prompt — same Redis cache
// key invalidation pattern, different namespace (`sentence-card:vN:…`).
// Bumped to 'v2' when the sentence-layout `audio` field was removed from
// the model and its "do not invent audio" prompt line dropped. Bumped to
// 'v3' when the prompt gained a one-shot worked example and the call moved
// to low temperature + a fixed seed for run-to-run consistency.
const SENTENCE_CARD_PROMPT_VERSION = "v3";

// Sentence cards live on the same 7-day TTL as vocabulary cards (per
// TDD §10.1). The cache key already discriminates by version + topic +
// learner level + interests; a long TTL just delays the natural eviction.
const SENTENCE_CARD_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

// ── Sentence-card generator helpers ──────────────────────────────────────────

interface SentenceCardInputs {
	safeTopic: string;
	safeLevel: string;
	safeInterests: string[];
}

function buildSentenceCardInputs(
	topic: string,
	userLevel: string,
	interests: string[],
): SentenceCardInputs {
	return {
		safeTopic: sanitizeForPrompt(topic),
		safeLevel: sanitizeForPrompt(userLevel),
		safeInterests: interests.map(s => sanitizeForPrompt(s)),
	};
}

// One worked example anchoring depth + the furigana/breakdown conventions.
// A different topic from any likely target, teaching shape not content.
const SENTENCE_CARD_EXAMPLE = `{
  "ja": "週末は友だちと映画を見に行きます。",
  "en": "On the weekend I'm going to see a movie with friends.",
  "furigana": "しゅうまつはともだちとえいがをみにいきます。",
  "breakdown": [
    { "token": "週末", "reading": "しゅうまつ", "meaning": "weekend" },
    { "token": "友だち", "reading": "ともだち", "meaning": "friend" },
    { "token": "映画", "reading": "えいが", "meaning": "movie" },
    { "token": "見に行きます", "reading": "みにいきます", "meaning": "go to see" }
  ],
  "nuance": "〜に行く attaches the purpose of a trip; the polite ます-form keeps it everyday rather than formal."
}`;

async function callSentenceCardGenerator(
	client: NonNullable<typeof openai>,
	inputs: SentenceCardInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedSentenceCard> {
	try {
		return await parseWithRepair(
			client,
			{
				// Structured generator: low temperature + fixed seed for
				// consistency. Model stays on the general chat model (nano) —
				// upgrading the sentence-layout branch to CHAT_MODEL_STRUCTURED
				// is a deliberate follow-up decision, not bundled here.
				model: CHAT_MODEL,
				temperature: STRUCTURED_TEMPERATURE,
				seed: STRUCTURED_SEED,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content: `You are a Japanese language expert authoring example-sentence SRS cards.
Always respond with valid JSON and nothing else.
User level: ${inputs.safeLevel}. User interests: ${joinInterests(inputs.safeInterests)}.
Sentence content must be natural, level-appropriate, and lean on the user's interests when possible. The sentence is the headline content — it is not a side example; it is the card.`,
					},
					{
						role: "user",
						content: `Generate one example-sentence card for the topic or seed phrase: ${inputs.safeTopic}

Return JSON with these keys:
{
  "ja":        string (one natural Japanese sentence using kanji + kana as a learner at ${inputs.safeLevel} would actually see it),
  "en":        string (English gloss — a translation that captures the sentence's register, not a word-for-word transliteration),
  "furigana":  string (hiragana annotation for the kanji in the sentence; readings only — keep particles and hiragana characters identical to "ja"),
  "breakdown": [{ "token": string, "reading"?: string, "meaning"?: string }] (optional; one entry per content-bearing token. Particles and punctuation may omit reading + meaning. Skip entirely if the sentence is too short to benefit from breakdown.),
  "nuance":    string (optional; 1–2 sentences on register / pragmatics — what makes this sentence noteworthy. Omit if there is nothing distinctive to say.)
}

Here is one example of the expected depth and format (for a DIFFERENT topic — match its quality, not its content):
${SENTENCE_CARD_EXAMPLE}`,
					},
				],
			},
			{ signal },
			GeneratedSentenceCardSchema,
			"generateSentenceCard",
		);
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateSentenceCard OpenAI request failed");
		throw err;
	}
}

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
 * Throws AppError(502) if OpenAI returns an empty or malformed response (after
 * one repair attempt). Throws ZodError only if validation fails in a way the
 * repair path cannot recover.
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

	const inputs = buildSentenceCardInputs(topic, userLevel, interests);

	// Distinct namespace from `card:…` (vocabulary). Prompt-version segment
	// mirrors the CARD_PROMPT_VERSION / DIAGNOSIS_PROMPT_VERSION pattern.
	const cacheKey = `sentence-card:${SENTENCE_CARD_PROMPT_VERSION}:${inputs.safeTopic}:${inputs.safeLevel}:${hashInterests(inputs.safeInterests)}`;

	const fromCache = await readCache(cacheKey, GeneratedSentenceCardSchema);
	if (fromCache !== null)
		return fromCache;

	const sentenceCard = await openaiSemaphore.run({ signal: opts?.signal }, () =>
		withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, () =>
			callSentenceCardGenerator(client, inputs, opts?.signal)));

	await redis.set(cacheKey, JSON.stringify(sentenceCard), { ex: SENTENCE_CARD_CACHE_TTL })
		.catch((err: unknown) => {
			log.warn({
				cacheKey,
				err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
			}, "AI cache write failed; result still returned");
		});
	return sentenceCard;
}
