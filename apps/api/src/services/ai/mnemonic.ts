import type { GeneratedMnemonic } from "@fsrs-japanese/shared-types";

import { GeneratedMnemonicSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, joinInterests, log, readCache } from "./shared.ts";

const MNEMONIC_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days — per TDD §10.1

// ── Mnemonic generator helpers ───────────────────────────────────────────────

interface MnemonicInputs {
	safeWord: string;
	safeLevel: string;
	safeNative: string;
	safeInterests: string[];
}

function buildMnemonicInputs(
	word: string,
	userLevel: string,
	nativeLanguage: string,
	interests: string[],
): MnemonicInputs {
	return {
		safeWord: sanitizeForPrompt(word),
		safeLevel: sanitizeForPrompt(userLevel),
		safeNative: sanitizeForPrompt(nativeLanguage),
		safeInterests: interests.map(s => sanitizeForPrompt(s)),
	};
}

function parseMnemonicResponse(raw: string | null | undefined): GeneratedMnemonic {
	if (raw === null || raw === undefined) {
		// 502 Bad Gateway is the right status here: OpenAI returned an HTTP
		// 200 with malformed content. Using AppError (vs plain Error) prevents
		// withBreaker from counting this against the chat breaker — see the
		// skip-AppError branch in lib/circuit-breaker.ts.
		throw new AppError(502, "OpenAI returned an empty response", { code: "OPENAI_EMPTY_RESPONSE" });
	}
	return GeneratedMnemonicSchema.parse(JSON.parse(raw));
}

async function callMnemonicGenerator(
	client: NonNullable<typeof openai>,
	inputs: MnemonicInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedMnemonic> {
	let response;
	try {
		response = await client.chat.completions.create({
			model: CHAT_MODEL,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: `You are a Japanese language tutor crafting memorable mnemonics.
Always respond with valid JSON.
User level: ${inputs.safeLevel}. Native language: ${inputs.safeNative}. Interests: ${joinInterests(inputs.safeInterests)}.
Mnemonics must be vivid, link sound + meaning, and reference the user's interests when possible.`,
				},
				{
					role: "user",
					content: `Generate one memorable mnemonic for the Japanese word: ${inputs.safeWord}

Return JSON with this exact shape:
{ "mnemonic": string }

Constraints:
- Keep it under 200 characters.
- Connect the reading to the meaning through a vivid image.
- Use the user's native language for the mnemonic text.`,
				},
			],
		}, { signal });
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateMnemonic OpenAI request failed");
		throw err;
	}

	return parseMnemonicResponse(response.choices[0]?.message.content);
}

/**
 * Generates a fresh mnemonic for a Japanese word, tailored to the user's
 * native language and interests.
 *
 * Cache key: `mnemonic:{word}:{userId}` — user-scoped because mnemonics
 * incorporate personal interests and L1. TTL: 30 days.
 */
export async function generateMnemonic(
	word: string,
	userId: string,
	userLevel: string,
	nativeLanguage: string,
	interests: string[],
	opts?: { signal?: AbortSignal },
): Promise<GeneratedMnemonic> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	const client = openai; // see generateCard for the narrowing rationale.

	const inputs = buildMnemonicInputs(word, userLevel, nativeLanguage, interests);
	const cacheKey = `mnemonic:${inputs.safeWord}:${userId}`;

	const fromCache = await readCache(cacheKey, GeneratedMnemonicSchema);
	if (fromCache !== null)
		return fromCache;

	const mnemonic = await openaiSemaphore.run({ signal: opts?.signal }, () =>
		withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, () =>
			callMnemonicGenerator(client, inputs, opts?.signal)));

	await redis.set(cacheKey, JSON.stringify(mnemonic), { ex: MNEMONIC_CACHE_TTL })
		.catch((err: unknown) => {
			log.warn({
				cacheKey,
				err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
			}, "AI cache write failed; result still returned");
		});
	return mnemonic;
}
