import type { GeneratedWeakSpotDiagnosis } from "@fsrs-japanese/shared-types";

import { GeneratedWeakSpotDiagnosisSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL_STRUCTURED, CHAT_UNAVAILABLE_MSG, ENHANCEMENT_REQUEST_OPTS, hashInterests, log, parseWithRepair, readCache, STRUCTURED_SEED, STRUCTURED_TEMPERATURE } from "./shared.ts";

// Diagnosis is weakSpot-specific (driven by lapse pattern) and stays valid only
// while the underlying card and review history are stable. 30 days is the
// same TTL as mnemonics — both are advisory text that doesn't need to be
// re-derived on every retry.
const DIAGNOSIS_CACHE_TTL = 60 * 60 * 24 * 30;

// Bump when the diagnosis prompt's system or user message changes in a way
// that should produce different output. The version becomes part of the
// cache key, so entries written under the old prompt are not served against
// the new prompt — they simply don't match the new key, the next call
// regenerates and caches under the versioned key, and the old entries TTL
// out naturally. Forward-only cache invalidation, zero downtime.
//
// v2: prompt now receives the lapse timeline (interval before each review) and
// the card's CURRENT content (example sentences + existing mnemonic) so the
// prescription can critique what the learner actually has rather than guess;
// added a one-shot worked example; moved to a stronger structured model at low
// temperature + fixed seed.
const DIAGNOSIS_PROMPT_VERSION = "v2";

// ── Weak-spot diagnosis generator helpers ───────────────────────────────────

/**
 * One past review of the card, oldest → newest. `elapsedDays` is the gap (in
 * days) since the previous review — the load-bearing signal for telling
 * "scheduled too aggressively" apart from "genuinely confusing card".
 */
export interface RecentReview {
	rating: string;
	elapsedDays: number;
}

/**
 * The card's current learner-facing content, so the prescription can critique
 * the real material instead of proposing something that already exists.
 */
export interface CardContent {
	exampleSentences: string[];
	mnemonic: string | null;
}

interface WeakSpotDiagnosisInputs {
	safeWord: string;
	safeReading: string;
	safeMeaning: string;
	safeLevel: string;
	safeNative: string;
	safeRatings: string[];
	elapsedDays: number[];
	timelinePhrase: string;
	safeSentences: string[];
	safeMnemonic: string;
	lapseCount: number;
}

// Cap the card content we inject so a card with many sentences can't crowd out
// the instruction text.
const MAX_DIAGNOSIS_SENTENCES = 3;

function buildWeakSpotDiagnosisInputs(
	word: string,
	reading: string | null,
	meaning: string,
	lapseCount: number,
	recentReviews: RecentReview[],
	userLevel: string,
	nativeLanguage: string,
	cardContent: CardContent,
): WeakSpotDiagnosisInputs {
	// Ratings are well-known enum values from review_logs.rating; sanitize
	// defensively in case future ratings include user text.
	const safeRatings = recentReviews.map(r => sanitizeForPrompt(r.rating));
	const elapsedDays = recentReviews.map(r => Math.max(0, Math.trunc(r.elapsedDays)));
	// Render "after Nd → Rating" per review so the model can see the rhythm of
	// failures, not just their count.
	const timelinePhrase = recentReviews.length > 0
		? recentReviews.map((r, i) => `after ${elapsedDays[i]}d → ${safeRatings[i]}`).join("; ")
		: "(no review history recorded)";
	const safeSentences = cardContent.exampleSentences
		.slice(0, MAX_DIAGNOSIS_SENTENCES)
		.map(s => sanitizeForPrompt(s, 200))
		.filter(s => s.length > 0);
	const safeMnemonic = cardContent.mnemonic !== null ? sanitizeForPrompt(cardContent.mnemonic, 200) : "";

	return {
		safeWord: sanitizeForPrompt(word),
		safeReading: reading !== null ? sanitizeForPrompt(reading) : "",
		safeMeaning: sanitizeForPrompt(meaning),
		safeLevel: sanitizeForPrompt(userLevel),
		safeNative: sanitizeForPrompt(nativeLanguage),
		safeRatings,
		elapsedDays,
		timelinePhrase,
		safeSentences,
		safeMnemonic,
		lapseCount,
	};
}

// One worked example anchoring the diagnose→prescribe shape: a plain-language
// cause and ONE concrete next step. Different word from any target.
const DIAGNOSIS_EXAMPLE = `{
  "diagnosis": "生 has two common on'yomi (せい / しょう) that are easy to mix up, and your misses cluster on short intervals — it's the reading that won't stick, not the meaning.",
  "prescription": "Drill 生 inside two fixed compounds instead of alone: 学生 (がくせい) and 一生 (いっしょう). Say each aloud three times so the reading binds to a whole word."
}`;

async function callWeakSpotDiagnosisGenerator(
	client: NonNullable<typeof openai>,
	inputs: WeakSpotDiagnosisInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedWeakSpotDiagnosis> {
	const sentencesBlock = inputs.safeSentences.length > 0
		? inputs.safeSentences.map(s => `  • ${s}`).join("\n")
		: "  (none on the card)";
	const mnemonicBlock = inputs.safeMnemonic !== "" ? inputs.safeMnemonic : "(none on the card)";

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
						content: `You are a Japanese-language SRS coach. The learner has lapsed on a card multiple times; you must diagnose why and prescribe one concrete next-step fix.
Always respond with valid JSON and nothing else.
Learner level: ${inputs.safeLevel}. Native language: ${inputs.safeNative}.

Common reasons a Japanese-learning card lapses:
- Ambiguous reading (e.g. 生 has many on'yomi/kun'yomi)
- Similar-kanji visual confusion (e.g. 持/侍, 王/玉)
- Okurigana inconsistency (e.g. 行う vs 行なう)
- Weak mnemonic linking sound to meaning
- Context-thin sentence — the meaning only makes sense in a specific register
- Pitch-accent confusion (heteronyms with different accents)
- Polysemy — one word, several distinct senses

Use the lapse timeline to tell scheduling problems apart from comprehension problems: misses that cluster on very short intervals point to a reading/recall that never consolidated; misses spread across long intervals point to a genuinely confusable card. When the card's existing mnemonic or example sentences are weak, say so specifically and have the prescription fix THAT, rather than inventing something unrelated.

Your diagnosis must name the most likely reason in plain learner language (not jargon). Your prescription must propose one concrete action: a specific mnemonic image, a kanji disambiguation tip, an example-sentence pattern to learn, or a similar-cards study set to drill.`,
					},
					{
						role: "user",
						content: `Card front: ${inputs.safeWord}
Reading: ${inputs.safeReading !== "" ? inputs.safeReading : "(unknown)"}
Meaning: ${inputs.safeMeaning}
Current lapse count: ${inputs.lapseCount}
Lapse timeline (oldest → newest, interval before each review): ${inputs.timelinePhrase}

The card's current content the learner already has:
- Example sentences:
${sentencesBlock}
- Existing mnemonic: ${mnemonicBlock}

Return JSON with this exact shape:
{ "diagnosis": string, "prescription": string }

Constraints:
- diagnosis: under 200 characters, plain language, names the likely cause.
- prescription: under 240 characters, names ONE concrete next step.
- Use the user's native language for both fields.
- Do not mention "AI" or apologize for being a model.

Here is one example of the expected style (for a DIFFERENT card — match its concreteness, not its content):
${DIAGNOSIS_EXAMPLE}`,
					},
				],
			},
			{ signal, ...ENHANCEMENT_REQUEST_OPTS },
			GeneratedWeakSpotDiagnosisSchema,
			"generateWeakSpotDiagnosis",
		);
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateWeakSpotDiagnosis OpenAI request failed");
		throw err;
	}
}

/**
 * Generates a diagnosis + prescription for a weakSpot: an explanation of *why*
 * the card keeps lapsing and one concrete next-step fix the learner can
 * apply. The weakSpot-management UI surfaces these alongside the card content.
 *
 * `recentReviews` is oldest → newest and carries both the rating and the
 * interval (days) before each review, so the model can separate aggressive
 * scheduling from a genuinely confusing card. `cardContent` is the learner's
 * existing sentences + mnemonic, so the prescription critiques real material.
 *
 * Cache key includes the card's word + lapse count + timeline + a fingerprint
 * of the current content, so a card that gets worse or whose content changes
 * regenerates; a stable card returns the cached diagnosis cheaply.
 *
 * Throws `OPENAI_KEY_MISSING` if env unset, `OPENAI_EMPTY_RESPONSE` /
 * `OPENAI_MALFORMED_RESPONSE` on malformed model output (after one repair), or
 * a `ServiceUnavailableError` (503) when the chat breaker is open.
 */
export async function generateWeakSpotDiagnosis(
	word: string,
	reading: string | null,
	meaning: string,
	lapseCount: number,
	recentReviews: RecentReview[],
	userLevel: string,
	nativeLanguage: string,
	cardContent: CardContent,
	opts?: { signal?: AbortSignal },
): Promise<GeneratedWeakSpotDiagnosis> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	const client = openai;

	const inputs = buildWeakSpotDiagnosisInputs(word, reading, meaning, lapseCount, recentReviews, userLevel, nativeLanguage, cardContent);
	// Cache key encodes every dimension that affects the diagnosis output:
	// prompt-template version, word, reading, lapse count, rating pattern,
	// learner level, native language, the interval sequence, and a fingerprint
	// of the card's current content. Same inputs → same diagnosis — shared
	// across users by design since the output depends on the card + lapse
	// pattern, not user identity. Per `CODING_STANDARDS_BACKEND.md` §Performance:
	// "cache keys include every dimension that affects the result."
	const contentFingerprint = hashInterests([...inputs.safeSentences, inputs.safeMnemonic]);
	const cacheKey = `diagnosis:${DIAGNOSIS_PROMPT_VERSION}:${inputs.safeWord}:${inputs.safeReading}:${inputs.lapseCount}:${inputs.safeLevel}:${inputs.safeNative}:${inputs.safeRatings.join(",")}:${inputs.elapsedDays.join(".")}:${contentFingerprint}`;

	const fromCache = await readCache(cacheKey, GeneratedWeakSpotDiagnosisSchema);
	if (fromCache !== null)
		return fromCache;

	const diagnosis = await openaiSemaphore.run({ signal: opts?.signal }, () =>
		withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, () =>
			callWeakSpotDiagnosisGenerator(client, inputs, opts?.signal)));

	await redis.set(cacheKey, JSON.stringify(diagnosis), { ex: DIAGNOSIS_CACHE_TTL })
		.catch((err: unknown) => {
			log.warn({
				cacheKey,
				err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
			}, "AI cache write failed; result still returned");
		});
	return diagnosis;
}
