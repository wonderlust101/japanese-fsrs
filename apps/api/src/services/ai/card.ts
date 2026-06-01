import type { GeneratedCardData } from "@fsrs-japanese/shared-types";

import { GeneratedCardDataSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL_STRUCTURED, CHAT_UNAVAILABLE_MSG, hashInterests, joinInterests, log, parseWithRepair, readCache, STRUCTURED_SEED, STRUCTURED_TEMPERATURE } from "./shared.ts";

const CARD_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days — per TDD §10.1

// Bump when the `generateCard` prompt changes in a way that should produce
// different output. The version becomes part of the cache key, so entries
// written under the old prompt are not served against the new prompt — they
// simply don't match the new key, the next call regenerates and caches under
// the versioned key, and the old entries TTL out naturally. Forward-only cache
// invalidation, zero downtime. Bumped to 'v2' in Backend Completion Plan Stage 2
// when the prompt grew to ask for `pitchPosition` and `nuance`. Bumped to 'v3'
// in Stage 3 when the prompt grew to request `collocations`, `homophones`, and
// the widened `kanjiBreakdown` shape ({kanji, radical, meaning, reading}).
// Bumped to 'v4' when `collocations`, `homophones`, and all audio fields
// (`expressionAudio`, example-sentence `sentenceAudio`) were removed from the
// card model. Bumped to 'v5' when `partOfSpeech` and `pitchAccent` were
// constrained to closed enums in the prompt (POS uses the hiragana verb /
// adjective convention). Entries cached under prior keys are bypassed by the
// new key shape, so cache-warm cost spikes once per deploy and steady-state hit
// rate recovers as v5 entries populate. Bumped to 'v6' when the prompt gained
// explicit per-JLPT-level example-sentence rules, word-tier self-inference,
// per-field quality rules (grammar variety, synonym-contrasting nuance), and a
// one-shot worked example — alongside low temperature + a fixed seed for
// run-to-run consistency.
//
// Schema-admitted but intentionally NOT in the prompt (kept here so a future
// reader doesn't try to "fix" the omission): `picture`. It requires a hosted
// asset the system cannot yet produce; asking the model for a URL it can't
// fulfill produces hallucinated 404s, which is worse than no field. The schema
// admits it so a future prompt-version bump or out-of-band populator can land
// without a second schema change.
const CARD_PROMPT_VERSION = "v6";

// ── Card generator helpers ───────────────────────────────────────────────────

interface CardInputs {
	safeWord: string;
	safeLevel: string;
	safeInterests: string[];
}

function buildCardInputs(word: string, userLevel: string, interests: string[]): CardInputs {
	return {
		safeWord: sanitizeForPrompt(word),
		safeLevel: sanitizeForPrompt(userLevel),
		safeInterests: interests.map(s => sanitizeForPrompt(s)),
	};
}

// One worked example anchoring the expected depth, field discipline, and
// furigana convention. Deliberately a DIFFERENT word from any likely target so
// it teaches the *shape* without biasing the content. Demonstrates: grammar
// variety across sentences (plain present / past negative / polite invitation),
// a kanji breakdown with radical + reading, a confident pitch class + position,
// and a synonym-contrasting nuance.
const CARD_EXAMPLE = `{
  "word": "食べる",
  "reading": "たべる",
  "meaning": "to eat",
  "partOfSpeech": "る verb",
  "exampleSentences": [
    { "ja": "毎朝パンを食べる。", "en": "I eat bread every morning.", "furigana": "まいあさパンをたべる。" },
    { "ja": "昨日は何も食べなかった。", "en": "I didn't eat anything yesterday.", "furigana": "きのうはなにもたべなかった。" },
    { "ja": "一緒に晩ご飯を食べませんか。", "en": "Would you like to eat dinner together?", "furigana": "いっしょにばんごはんをたべませんか。" }
  ],
  "kanjiBreakdown": [
    { "kanji": "食", "radical": "eat", "meaning": "eat, food", "reading": "た" }
  ],
  "pitchAccent": "nakadaka",
  "pitchPosition": 2,
  "nuance": "Neutral, everyday verb for eating. Rougher/masculine 食う is casual; 頂く is the humble form used when politely receiving food.",
  "mnemonic": "Picture a TAH-BEH table where you sit down to eat."
}`;

async function callCardGenerator(
	client: NonNullable<typeof openai>,
	inputs: CardInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedCardData> {
	try {
		return await parseWithRepair(
			client,
			{
				model: CHAT_MODEL_STRUCTURED,
				temperature: STRUCTURED_TEMPERATURE,
				seed: STRUCTURED_SEED,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content: `You are a Japanese language expert generating SRS card data.
Always respond with valid JSON and nothing else.
User level: ${inputs.safeLevel}. User interests: ${joinInterests(inputs.safeInterests)}.

First, infer the JLPT tier of the TARGET WORD itself (N5 easiest → N1 hardest, or beyond-JLPT for native/literary/domain vocabulary). Pitch example-sentence difficulty to the harder of {the word's own tier, the user's level}, but cap the surrounding vocabulary so a ${inputs.safeLevel} learner can still read each sentence.

Example-sentence level rubric:
- N5: ≤ 8 words, kana-heavy, plain or polite present/past, everyday topics.
- N4: short sentences, common particles, te-form and basic conjugations.
- N3: natural everyday register, compound sentences allowed.
- N2: idiomatic, more abstract topics, varied connectives.
- N1: fully natural native register, nuanced vocabulary.

Tie example sentences to the user's interests when it does not distort naturalness.`,
					},
					{
						role: "user",
						content: `Generate complete card data for the Japanese word: ${inputs.safeWord}

Return JSON with these keys:
{
  "word": string,
  "reading": string (hiragana/katakana reading),
  "meaning": string (English meaning),
  "partOfSpeech": string (choose EXACTLY ONE of these literal values: "Noun", "る verb", "う verb", "Irregular verb", "い adjective", "な adjective", "Adverb", "Particle", "Conjunction", "Expression", "Counter". For verbs use the hiragana form: ichidan/ru-verbs are "る verb", godan/u-verbs are "う verb". Omit the field if none fit.),
  "exampleSentences": [{ "ja": string, "en": string, "furigana": string }] (provide 2–3 sentences; EACH must use a DIFFERENT grammatical structure — e.g. one plain statement, one question or negative, one using a connective or polite form — and EACH must contain the target word. "furigana" replaces only the kanji with their hiragana readings and keeps every kana and particle identical to "ja".),
  "kanjiBreakdown": [{ "kanji": string, "radical": string (the radical name in English, e.g. "person" or "water" — omit per-character if unsure), "meaning": string, "reading": string (the on-yomi or kun-yomi most relevant in this word, hiragana or katakana — omit per-character if unsure) }],
  "pitchAccent": string (choose EXACTLY ONE of these literal values: "heiban", "atamadaka", "nakadaka", "odaka". Omit the field if you are not confident.),
  "pitchPosition": integer (mora position of the pitch drop; 0 = heiban / flat, 1 = drop after the first mora, 2 = drop after the second mora, etc. Omit the field if you are not confident.),
  "nuance": string (1–2 sentences in English that CONTRAST the word with a close synonym OR name a register/connotation constraint — what a learner needs to use it correctly, not just translate it. Omit only if there is genuinely nothing distinctive to say.),
  "mnemonic": string (memorable association for a ${inputs.safeLevel} learner)
}

Here is one example of the expected depth and format (for a DIFFERENT word — match its quality, not its content):
${CARD_EXAMPLE}

Do NOT invent a value for "picture" (image URL). It requires a hosted asset the system cannot yet produce; if you do not have a real, hostable URL, omit the field entirely.`,
					},
				],
			},
			{ signal },
			GeneratedCardDataSchema,
			"generateCard",
		);
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateCard OpenAI request failed");
		throw err;
	}
}

/**
 * Generates structured card data for a Japanese word.
 *
 * Cache key: `card:{word}:{userLevel}:{interestsHash}` — shared across all
 * users with the same level and interest profile to maximise cache hits.
 * TTL: 7 days.
 *
 * Throws AppError(502) if OpenAI returns an empty response.
 * Throws ZodError if the response shape does not match `GeneratedCardDataSchema`.
 */
export async function generateCard(
	word: string,
	userLevel: string,
	interests: string[],
	opts?: { signal?: AbortSignal },
): Promise<GeneratedCardData> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	// Capture the narrowed (non-null) reference into a local. The inner closure
	// below sees `openai` widened back to `OpenAI | null` — the local survives
	// the closure boundary as a non-null without needing a `!` assertion.
	const client = openai;

	const inputs = buildCardInputs(word, userLevel, interests);
	// Cache key includes CARD_PROMPT_VERSION so a Stage-2 prompt rewrite
	// (e.g. adding pitchPosition + nuance) cleanly bypasses entries written
	// by the previous prompt. Mirrors the diagnosis-cache versioning at
	// ai/diagnosis.ts:`DIAGNOSIS_PROMPT_VERSION`.
	const cacheKey = `card:${CARD_PROMPT_VERSION}:${inputs.safeWord}:${inputs.safeLevel}:${hashInterests(inputs.safeInterests)}`;

	const fromCache = await readCache(cacheKey, GeneratedCardDataSchema);
	if (fromCache !== null)
		return fromCache;

	// Breaker integration runs only on a cache miss. A network exception, an
	// empty response, or a Zod parse failure inside the call helper all become
	// 503 via withBreaker's catch path; specific diagnostic info goes to the
	// log line inside callCardGenerator. The outer try/catch inside that helper
	// is kept solely to scrub `sk-…` tokens from `err.message` (the SDK leaks
	// them in 401 messages).
	const card = await openaiSemaphore.run({ signal: opts?.signal }, () =>
		withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, () =>
			callCardGenerator(client, inputs, opts?.signal)));

	// Cache write outside the breaker — a Redis blip should not trip the
	// OpenAI breaker. If the write fails, the work already succeeded; we just
	// miss caching this entry and the next equivalent request hits OpenAI.
	await redis.set(cacheKey, JSON.stringify(card), { ex: CARD_CACHE_TTL })
		.catch((err: unknown) => {
			log.warn({
				cacheKey,
				err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
			}, "AI cache write failed; result still returned");
		});
	return card;
}
