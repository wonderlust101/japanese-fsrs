import type { GeneratedSentences } from "@fsrs-japanese/shared-types";

import { GeneratedSentencesSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, CREATIVE_TEMPERATURE, hashInterests, joinInterests, log, readCache } from "./shared.ts";

const SENTENCES_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

// Prompt-template version baked into the cache key. Previously absent, so a
// prompt edit silently served stale pre-edit entries for up to the 7-day TTL.
// Bump on any change to the system/user message that should produce different
// output. 'v1' = the grammar-variety + JLPT-grading + word-presence revision.
const SENTENCES_PROMPT_VERSION = "v1";

// Conjugation-aware presence check. A literal `ja.includes(word)` wrongly
// rejects correct sentences because Japanese verbs/adjectives conjugate
// (食べる → 食べた / 食べて). Match instead on the word's kanji core — the
// leading kanji run survives conjugation (the okurigana kana tail is what
// changes) — falling back to a kana stem for kana-only words.
function wordCore(word: string): string {
	// First run of CJK ideographs (kanji) anywhere in the word. Range is the
	// CJK Unified Ideographs block (U+4E00–U+9FAF) plus the iteration mark 々.
	const kanjiRun = word.match(/[\u4E00-\u9FAF々]+/);
	if (kanjiRun !== null)
		return kanjiRun[0];
	// Kana-only word: drop one trailing kana as a crude stem (covers る/う-verbs
	// and い-adjectives) but never shrink a 1–2 char word below itself.
	return word.length > 2 ? word.slice(0, -1) : word;
}

function sentenceHasWord(ja: string, word: string): boolean {
	return ja.includes(word) || ja.includes(wordCore(word));
}

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
			temperature: CREATIVE_TEMPERATURE,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: `You are a Japanese language expert generating natural example sentences for SRS flash cards.
Always respond with valid JSON.
User level: ${inputs.safeLevel}. User interests: ${joinInterests(inputs.safeInterests)}.
Sentences must be natural, level-appropriate, and tied to the user's interests when possible.

Infer the JLPT tier of the target word, then pitch each sentence to the harder of {the word's tier, the user's level} while capping the SURROUNDING vocabulary so a ${inputs.safeLevel} learner can still read it. Grading guide: N5 = ≤ 8 words, kana-heavy, plain/polite present-past; N4 = te-form and basic conjugations; N3 = natural everyday register, compound sentences; N2 = idiomatic, abstract topics; N1 = fully natural native register.`,
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
- Each "ja" must contain the target word (a conjugated form is fine).
- Span DIFFERENT grammatical structures across the set — draw from: plain statement, question, negative, past tense, te-form/continuative, and a connective (から / ので / 〜とき). Do not repeat the same pattern twice.
- "furigana" should give hiragana readings for kanji compounds in the sentence; keep kana and particles identical to "ja".${
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

	// Word-presence guard (conjugation-aware). Drop any sentence that doesn't
	// actually use the target word so the "each ja contains the word" promise
	// holds. If the model returned sentences but NONE are on target, surface a
	// 502 (AppError → not counted against the chat breaker) rather than handing
	// back off-topic sentences.
	const parsed = parseSentencesResponse(response.choices[0]?.message.content);
	const onTarget = parsed.sentences.filter(s => sentenceHasWord(s.ja, inputs.safeWord));
	if (onTarget.length === 0 && parsed.sentences.length > 0) {
		throw new AppError(502, "Generated sentences did not contain the target word", { code: "OPENAI_SENTENCES_OFF_TARGET" });
	}
	return { sentences: onTarget };
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
	const cacheKey = `sentences:${SENTENCES_PROMPT_VERSION}:${inputs.safeWord}:${inputs.safeLevel}:${hashInterests(inputs.safeInterests)}:${inputs.safeCount}${avoidSeg}`;

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
