import type { GeneratedTomoNote } from "@fsrs-japanese/shared-types";

import { GeneratedTomoNoteSchema, sanitizeForPrompt } from "@fsrs-japanese/shared-types";
import { redis } from "../../db/redis.ts";
import { withBreaker } from "../../lib/circuit-breaker.ts";
import { openai, openaiSemaphore } from "../../lib/openai.ts";
import { scrubKeyish } from "../../lib/scrub.ts";
import { AppError } from "../../middleware/errorHandler.ts";

import { CHAT_BREAKER, CHAT_MODEL, CHAT_UNAVAILABLE_MSG, CREATIVE_TEMPERATURE, joinInterests, log, readCache } from "./shared.ts";

// Bump on any change to the Tomo daily-note prompt body so cached notes from
// the previous template aren't served against the new prompt. 'v2' = good/bad
// voice exemplars + due-today and weak-spot context fed into the note.
const TOMO_NOTE_PROMPT_VERSION = "v2";

// Tomo note cache TTL — 36h. The cache key is keyed by `dateKey` (one
// learner-local day), so a longer TTL never serves the wrong day. 36h is
// just enough slack to cover late-evening reads that round into the next
// day in the learner's timezone without leaving the entry sitting in
// Redis forever.
const TOMO_NOTE_CACHE_TTL = 60 * 60 * 36;

// ── Tomo-note generator helpers ──────────────────────────────────────────────

interface TomoNoteInputs {
	safeLevel: string;
	safeNative: string;
	safeInterests: string[];
	safeDateKey: string;
	yesterdaySummary: string;
	dueSummary: string;
	weakSpotSummary: string;
}

// Cap weak-spot words injected so a long list can't crowd the instruction text.
const MAX_TOMO_WEAK_SPOTS = 5;

function buildTomoNoteInputs(
	dateKey: string,
	userLevel: string,
	nativeLanguage: string,
	interests: string[],
	yesterdayReviews: number | null,
	yesterdayRetention: number | null,
	dueToday: number | null,
	weakSpotWords: string[],
): TomoNoteInputs {
	// Render yesterday's signal into plain prose for the prompt. The empty
	// branch keeps the line readable when the learner hasn't reviewed yet today;
	// the model is told to handle that case explicitly in the prompt body.
	const yesterdaySummary = yesterdayReviews !== null
	// `yesterdayRetention` comes straight from get_heatmap_data, which
	// already returns retention as a 0–100 percentage — do not multiply
	// by 100 again (that produced "8070% retention" in the prompt).
		? `Reviewed ${yesterdayReviews} cards yesterday${yesterdayRetention !== null ? ` with ${Math.round(yesterdayRetention)}% retention` : ""}.`
		: "No reviews recorded yesterday.";

	// Due-today is the source-of-truth count from get_due_cards (null = couldn't
	// load; omit rather than guess). Lets the morning note orient to the session.
	const dueSummary = dueToday === null
		? ""
		: dueToday === 0
			? "Nothing is due right now."
			: `${dueToday} card${dueToday === 1 ? " is" : "s are"} due now.`;

	const safeWeakSpots = weakSpotWords
		.slice(0, MAX_TOMO_WEAK_SPOTS)
		.map(w => sanitizeForPrompt(w, 50))
		.filter(w => w.length > 0);
	const weakSpotSummary = safeWeakSpots.length > 0
		? `Words currently giving trouble: ${safeWeakSpots.join(", ")}.`
		: "";

	return {
		safeLevel: sanitizeForPrompt(userLevel),
		safeNative: sanitizeForPrompt(nativeLanguage),
		safeInterests: interests.map(s => sanitizeForPrompt(s)),
		// dateKey is server-computed (not user input) but sanitize defensively so
		// a future caller that pipes user input in can't poison the cache key.
		safeDateKey: sanitizeForPrompt(dateKey),
		yesterdaySummary,
		dueSummary,
		weakSpotSummary,
	};
}

function parseTomoNoteResponse(raw: string | null | undefined): GeneratedTomoNote {
	if (raw === null || raw === undefined) {
		throw new AppError(502, "OpenAI returned an empty response", { code: "OPENAI_EMPTY_RESPONSE" });
	}
	return GeneratedTomoNoteSchema.parse(JSON.parse(raw));
}

async function callTomoNoteGenerator(
	client: NonNullable<typeof openai>,
	inputs: TomoNoteInputs,
	signal: AbortSignal | undefined,
): Promise<GeneratedTomoNote> {
	let response;
	try {
		response = await client.chat.completions.create({
			model: CHAT_MODEL,
			temperature: CREATIVE_TEMPERATURE,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: `Role:
You are Tomo, a calm English-speaking tutor for learners of Japanese.

Task:
Write one short prose note for the learner after a practice session.

Context:
The learner is studying Japanese.
Learner level: ${inputs.safeLevel}.
Native language: ${inputs.safeNative}.${inputs.safeInterests.length > 0 ? ` Interests: ${joinInterests(inputs.safeInterests)}.` : ""}

Goal:
Help the learner notice one small, useful thing about their Japanese practice.
The note should feel warm, attentive, and grounded, like a thoughtful tutor who has been quietly watching their progress.

Constraints:
- The JSON value "body" MUST be written in English.
- Do not write Japanese sentences in body.
- You may include Japanese words only as brief quoted examples when useful.
- Keep body under 200 characters.
- Write one observation or one micro-suggestion.
- Do not write a list.
- Do not greet.
- Do not sign off.
- Do not mention AI.
- Do not apologize for being a model.
- Do not mention dates or "today / yesterday" literally if the practice data is missing.
- When practice data is informative, refer to the learner's actual practice.
- When practice data is thin or missing, speak from the craft of learning Japanese.

Voice:
Quiet, warm, and grounded.
Kind, but not perky.
Encouraging, but not motivational-poster.
Specific rather than generic.
Use plain, natural English.

Format:
Always respond with valid JSON.
Return JSON with this exact shape:
{ "body": string }

Quality bar:
A good note should feel like a small useful observation from a real tutor.
It should not sound automated, inflated, vague, cute, or overly enthusiastic.
Prefer concrete noticing over praise.
Prefer gentle direction over encouragement.
The learner should feel seen, not managed.
When cards are due, you may gently orient the learner toward the session ahead.
When a trouble word is listed, you may name one concretely (quoted) rather than speaking in general.

Examples of the register (do not reuse the wording):
GOOD: "Your readings on the 〜つ counters are steadying — worth one slow pass while they're fresh."
GOOD: "A short sit today, but the work was clean. Small, honest reps are how this sticks."
AVOID (too perky): "Amazing job today!! You're absolutely crushing it 🎉 keep it up!!"
AVOID (too generic): "Keep practicing every day to improve your Japanese."`,
				},
				{
					role: "user",
					content: `Practice summary:
${inputs.yesterdaySummary}${inputs.dueSummary !== "" ? `\n${inputs.dueSummary}` : ""}${inputs.weakSpotSummary !== "" ? `\n${inputs.weakSpotSummary}` : ""}

Write one warm, grounded English note based on the practice summary.

Return JSON with this exact shape:
{ "body": string }`,
				},
			],
		}, { signal });
	} catch (err) {
		log.error({
			err: {
				name: err instanceof Error ? err.name : "Unknown",
				message: scrubKeyish(err),
			},
		}, "generateTomoNote OpenAI request failed");
		throw err;
	}

	return parseTomoNoteResponse(response.choices[0]?.message.content);
}

/**
 * Generates one daily Tomo note: a short prose line a learner sees when they
 * land on the review staging page (Backend Completion Plan Stage 6).
 *
 * Cost ceiling is one AI call per learner per day. Caching is keyed by the
 * learner's local calendar day (`dateKey`) — different timezones get
 * different keys naturally; same-day retries hit the cache. The
 * `TOMO_NOTE_PROMPT_VERSION` is baked into the cache key so a prompt edit
 * cleanly bypasses stale entries.
 *
 * Callers (specifically `tomo-note.service.ts`) catch these and fall back to
 * a curated idiom rather than surfacing a 5xx — the route never returns an
 * error envelope for this endpoint.
 */
export async function generateTomoNote(
	userId: string,
	dateKey: string,
	userLevel: string,
	nativeLanguage: string,
	interests: string[],
	yesterdayReviews: number | null,
	yesterdayRetention: number | null,
	dueToday: number | null,
	weakSpotWords: string[],
	opts?: { signal?: AbortSignal },
): Promise<GeneratedTomoNote> {
	if (openai === null)
		throw new AppError(500, "OPENAI_API_KEY not configured", { code: "OPENAI_KEY_MISSING" });
	const client = openai;

	const inputs = buildTomoNoteInputs(dateKey, userLevel, nativeLanguage, interests, yesterdayReviews, yesterdayRetention, dueToday, weakSpotWords);
	// Cache key includes (version, userId, dateKey). userId scopes to one
	// learner; dateKey scopes to one calendar day in their timezone; version
	// invalidates the whole keyspace on prompt edits.
	const cacheKey = `tomo:note:${TOMO_NOTE_PROMPT_VERSION}:${userId}:${inputs.safeDateKey}`;

	const fromCache = await readCache(cacheKey, GeneratedTomoNoteSchema);
	if (fromCache !== null)
		return fromCache;

	const note = await openaiSemaphore.run({ signal: opts?.signal }, () =>
		withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, () =>
			callTomoNoteGenerator(client, inputs, opts?.signal)));

	await redis.set(cacheKey, JSON.stringify(note), { ex: TOMO_NOTE_CACHE_TTL })
		.catch((err: unknown) => {
			log.warn({
				cacheKey,
				err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
			}, "AI cache write failed; result still returned");
		});
	return note;
}
