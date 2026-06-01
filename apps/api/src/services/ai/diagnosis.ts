import type { GeneratedWeakSpotDiagnosis } from "@fsrs-japanese/shared-types";

import { GeneratedWeakSpotDiagnosisSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, ENHANCEMENT_REQUEST_OPTS, log, readCache } from "./shared.ts";

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
const DIAGNOSIS_PROMPT_VERSION = "v1";

// ── Weak-spot diagnosis generator helpers ───────────────────────────────────

interface WeakSpotDiagnosisInputs {
	safeWord: string;
	safeReading: string;
	safeMeaning: string;
	safeLevel: string;
	safeNative: string;
	safeRatings: string[];
	lapseCount: number;
}

function buildWeakSpotDiagnosisInputs(
	word: string,
	reading: string | null,
	meaning: string,
	lapseCount: number,
	recentRatings: string[],
	userLevel: string,
	nativeLanguage: string,
): WeakSpotDiagnosisInputs {
	return {
		safeWord: sanitizeForPrompt(word),
		safeReading: reading !== null ? sanitizeForPrompt(reading) : "",
		safeMeaning: sanitizeForPrompt(meaning),
		safeLevel: sanitizeForPrompt(userLevel),
		safeNative: sanitizeForPrompt(nativeLanguage),
		// Ratings are well-known enum values from review_logs.rating; sanitize
		// defensively in case future ratings include user text.
		safeRatings: recentRatings.map(r => sanitizeForPrompt(r)),
		lapseCount,
	};
}

function parseWeakSpotDiagnosisResponse(raw: string | null | undefined): GeneratedWeakSpotDiagnosis {
	if (raw === null || raw === undefined) {
		throw new AppError(502, "OpenAI returned an empty response", { code: "OPENAI_EMPTY_RESPONSE" });
	}
	return GeneratedWeakSpotDiagnosisSchema.parse(JSON.parse(raw));
}

async function callWeakSpotDiagnosisGenerator(
	client: NonNullable<typeof openai>,
	inputs: WeakSpotDiagnosisInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedWeakSpotDiagnosis> {
	let response;
	try {
		response = await client.chat.completions.create({
			model: CHAT_MODEL,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: `You are a Japanese-language SRS coach. The learner has lapsed on a card multiple times; you must diagnose why and prescribe one concrete next-step fix.
Always respond with valid JSON.
Learner level: ${inputs.safeLevel}. Native language: ${inputs.safeNative}.

Common reasons a Japanese-learning card lapses:
- Ambiguous reading (e.g. 生 has many on'yomi/kun'yomi)
- Similar-kanji visual confusion (e.g. 持/侍, 王/玉)
- Okurigana inconsistency (e.g. 行う vs 行なう)
- Weak mnemonic linking sound to meaning
- Context-thin sentence — the meaning only makes sense in a specific register
- Pitch-accent confusion (heteronyms with different accents)
- Polysemy — one word, several distinct senses

Your diagnosis must name the most likely reason in plain learner language (not jargon). Your prescription must propose one concrete action: a specific mnemonic image, a kanji disambiguation tip, an example-sentence pattern to learn, or a similar-cards study set to drill.`,
				},
				{
					role: "user",
					content: `Card front: ${inputs.safeWord}
Reading: ${inputs.safeReading !== "" ? inputs.safeReading : "(unknown)"}
Meaning: ${inputs.safeMeaning}
Current lapse count: ${inputs.lapseCount}
Recent ratings (oldest → newest): ${inputs.safeRatings.length > 0 ? inputs.safeRatings.join(", ") : "(none recorded)"}

Return JSON with this exact shape:
{ "diagnosis": string, "prescription": string }

Constraints:
- diagnosis: under 200 characters, plain language, names the likely cause.
- prescription: under 240 characters, names ONE concrete next step.
- Use the user's native language for both fields.
- Do not mention "AI" or apologize for being a model.`,
				},
			],
		}, { signal, ...ENHANCEMENT_REQUEST_OPTS });
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateWeakSpotDiagnosis OpenAI request failed");
		throw err;
	}

	return parseWeakSpotDiagnosisResponse(response.choices[0]?.message.content);
}

/**
 * Generates a diagnosis + prescription for a weakSpot: an explanation of *why*
 * the card keeps lapsing and one concrete next-step fix the learner can
 * apply. The weakSpot-management UI surfaces these alongside the card content.
 *
 * Cache key includes the card's word + the lapse count, so a card that gets
 * worse over time can regenerate; a card whose lapse pattern is stable
 * returns the cached diagnosis cheaply.
 *
 * Throws `OPENAI_KEY_MISSING` if env unset, `OPENAI_EMPTY_RESPONSE` on
 * malformed model output, or a `ServiceUnavailableError` (503) when the
 * chat breaker is open. ZodError if structured-output validation fails.
 */
export async function generateWeakSpotDiagnosis(
	word: string,
	reading: string | null,
	meaning: string,
	lapseCount: number,
	recentRatings: string[],
	userLevel: string,
	nativeLanguage: string,
	opts?: { signal?: AbortSignal },
): Promise<GeneratedWeakSpotDiagnosis> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	const client = openai;

	const inputs = buildWeakSpotDiagnosisInputs(word, reading, meaning, lapseCount, recentRatings, userLevel, nativeLanguage);
	// Cache key encodes every dimension that affects the diagnosis output:
	// prompt-template version (bumped when the prompt body changes), word,
	// reading, lapse count, recent rating pattern, learner level, and native
	// language. Same inputs → same diagnosis — shared across users by design
	// since the output depends on the card + the lapse pattern, not on user
	// identity. Per `CODING_STANDARDS_BACKEND.md` §Performance: "cache keys
	// include every dimension that affects the result."
	const cacheKey = `diagnosis:${DIAGNOSIS_PROMPT_VERSION}:${inputs.safeWord}:${inputs.safeReading}:${inputs.lapseCount}:${inputs.safeLevel}:${inputs.safeNative}:${inputs.safeRatings.join(",")}`;

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
