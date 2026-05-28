// Weak-spot diagnosis service: AI-backed single + batch diagnosis.
// Lifted out of weak-spot.service.ts; re-exported from there.

import type { ApiWeakSpotListItem, FieldsData } from "@fsrs-japanese/shared-types";
import { getWordFields } from "@fsrs-japanese/shared-types";
import { z } from "zod";
import { supabaseAdmin } from "../db/supabase.ts";
import { componentLogger } from "../lib/logger.ts";
import { AppError, dbError } from "../middleware/errorHandler.ts";
import { generateWeakSpotDiagnosis } from "./ai.service.ts";
import { getWeakSpotById } from "./weak-spot.service.ts";

const log = componentLogger("weakSpot.service");

const WeakSpotDiagnosisCardRowSchema = z.object({
	fields_data: z.record(z.string(), z.unknown()),
	layout_type: z.enum(["vocabulary", "grammar", "sentence"]),
	lapses: z.number().int().nonnegative(),
});

/** Profile slice we read for diagnosis voice (JLPT target + native language). */
const ProfileForDiagnosisSchema = z.object({
	jlpt_target: z.enum(["N5", "N4", "N3", "N2", "N1", "beyond_jlpt"]).nullable(),
	native_language: z.string(),
});

/**
 * Inferred profile slice. Accepted by diagnoseWeakSpot's `opts.profile` so a
 *  batch caller can prefetch it once instead of re-reading it per weak spot.
 */
type DiagnosisProfile = z.infer<typeof ProfileForDiagnosisSchema>;

/** Recent review-log ratings for the card, oldest → newest. */
const ReviewLogRatingRowSchema = z.object({
	rating: z.string(),
});

/**
 * Generates and persists a diagnosis + prescription for a weakSpot, then returns
 * the full joined detail (matching the `GET /:id` shape). Replay-on-existing:
 * if the weakSpot already has diagnosis text, no AI call is made and the stored
 * values are returned.
 *
 * Throws:
 *   • 404 WEAK_SPOT_NOT_FOUND — weakSpot missing or wrong owner.
 *   • 422 CARD_FIELDS_INSUFFICIENT — orphan weakSpot (card deleted) or
 *     card's fields_data lacks the word/meaning fields the prompt needs.
 *   • Anything else from `generateWeakSpotDiagnosis` (OPENAI_KEY_MISSING,
 *     OPENAI_EMPTY_RESPONSE, 503 from the chat breaker).
 *
 * Scheduler invariance: this function reads `cards`, `review_logs`, and
 * `weakSpots`. It writes only to `weakSpots` (the diagnosis + prescription text
 * columns). It does NOT mutate `cards.state` or any FSRS field, and it does
 * NOT insert into `review_logs`. The property-based suite covers the read-
 * only side; the write-only-to-weakSpots side is verified by the per-test
 * assertion that the only UPDATE is against `from('weakSpots')`.
 */
export async function diagnoseWeakSpot(
	userId: string,
	weakSpotId: string,
	opts?: { profile?: DiagnosisProfile },
): Promise<ApiWeakSpotListItem> {
	// 1. Fetch the weakSpot + its card (slim projection for prompt inputs).
	//    Filter by user_id to give 404 on cross-user attempts.
	const { data: weakSpotRow, error: fetchError } = await supabaseAdmin
		.from("weak_spots")
		.select(`
      id,
      card_id,
      diagnosis,
      prescription,
      resolved,
      card:cards (
        fields_data,
        layout_type,
        lapses
      )
    `)
		.eq("id", weakSpotId)
		.eq("user_id", userId)
		.maybeSingle();

	if (fetchError !== null) {
		log.error({ weakSpotId, err: { message: fetchError.message, code: fetchError.code } }, "diagnoseWeakSpot weakSpot fetch failed");
		throw dbError("fetch weakSpot for diagnosis", fetchError);
	}
	if (weakSpotRow === null) {
		throw new AppError(404, "WeakSpot not found", { code: "WEAK_SPOT_NOT_FOUND" });
	}

	// 2. Replay-on-existing: if the weakSpot already has diagnosis text, return
	//    the full envelope without calling OpenAI. Idempotent and cost-bounded.
	if (weakSpotRow.diagnosis !== null && weakSpotRow.prescription !== null) {
		return getWeakSpotById(userId, weakSpotId);
	}

	// 3. Orphan weakSpot (card_id NULL after card deletion) or insufficient card
	//    fields → 422. The prompt needs at least word/meaning to be useful.
	if (weakSpotRow.card_id === null || weakSpotRow.card === null) {
		throw new AppError(422, "Cannot diagnose an orphan weakSpot (card has been deleted)", {
			code: "CARD_FIELDS_INSUFFICIENT",
		});
	}

	const card = WeakSpotDiagnosisCardRowSchema.parse(weakSpotRow.card);

	// Extract word/reading/meaning from fields_data via the shared helper so
	// vocabulary and grammar cards both work; sentence-layout cards return
	// null fields and fail with the same 422.
	//
	// `WeakSpotDiagnosisCardRowSchema` already narrows `layout_type` to one of
	// 'vocabulary' | 'grammar' | 'sentence' (= LayoutType), so it is passed
	// through without a cast. `fields_data` is typed loosely as a record by the
	// row schema, so the `as FieldsData` cast below is load-bearing: FieldsData
	// is a NON-discriminated union, so its real runtime guarantee is the
	// cards_fields_data_shape CHECK constraint, not Zod. Same split toListItem()
	// uses for the list response (see this file, ~line 124). The standards file
	// (`CODING_STANDARDS.md` §Types) asks for a comment justifying the assertion.
	const fields = getWordFields({
		layoutType: card.layout_type,
		fieldsData: card.fields_data as FieldsData,
	});
	if (fields === null) {
		throw new AppError(422, "Card layout does not expose word/reading/meaning required for diagnosis", {
			code: "CARD_FIELDS_INSUFFICIENT",
		});
	}

	// 4. + 5. Ratings are per-card (always fetched). The profile (diagnosis
	//    voice: JLPT target + native language) is per-user and identical across
	//    a session, so a batch caller (batchDiagnoseForSession) can prefetch it
	//    once and pass it via `opts.profile` to skip N identical reads. When it
	//    is absent we fetch it here, in parallel with ratings, so the single-
	//    card path keeps its prior latency (~one Supabase round-trip, p50
	//    15-30ms). Both error branches degrade to safe defaults rather than
	//    failing the diagnosis — preferences can be sparse and review history
	//    can be empty, and neither should block AI.
	//
	//    EXPLAIN reasoning for the review_logs query: existing indexes are
	//      review_logs_card_id_idx (card_id)
	//      review_logs_user_id_reviewed_at_idx (user_id, reviewed_at)
	//    For our (card_id, user_id, ORDER BY reviewed_at DESC LIMIT 10) shape,
	//    the planner picks card_id_idx and sorts in memory. For the dominant
	//    "lapsed >= 8 times" diagnose targets, candidate rows per card are
	//    bounded (tens, not hundreds) so the sort is cheap. If observability
	//    ever shows this query exceeding 50ms p95, add a covering index on
	//    (card_id, user_id, reviewed_at DESC).
	const ratingsPromise = supabaseAdmin
		.from("review_logs")
		.select("rating")
		.eq("card_id", weakSpotRow.card_id)
		.eq("user_id", userId)
		.order("reviewed_at", { ascending: false })
		.limit(10);

	// PromiseLike, not Promise: supabase-js builders are thenables (no .catch/
	// .finally), and Promise.all accepts `T | PromiseLike<T>`.
	const profilePromise: PromiseLike<DiagnosisProfile> = opts?.profile !== undefined
		? Promise.resolve(opts.profile)
		: supabaseAdmin
				.from("profiles")
				.select("jlpt_target, native_language")
				.eq("id", userId)
				.maybeSingle()
				.then(({ data, error }) => {
					if (error !== null) {
						log.warn({ userId, err: { message: error.message, code: error.code } }, "diagnoseWeakSpot profile fetch failed; falling back to defaults");
					}
					return data !== null
						? ProfileForDiagnosisSchema.parse(data)
						: { jlpt_target: null, native_language: "en" };
				});

	const [{ data: ratingRows, error: ratingError }, profile] = await Promise.all([
		ratingsPromise,
		profilePromise,
	]);

	if (ratingError !== null) {
		log.warn({ weakSpotId, err: { message: ratingError.message, code: ratingError.code } }, "diagnoseWeakSpot review_logs fetch failed; proceeding with empty pattern");
	}
	const recentRatings = (ratingRows ?? [])
		.map(r => ReviewLogRatingRowSchema.parse(r).rating)
		.reverse(); // oldest → newest for the prompt

	// 6. Call OpenAI via the AI service. The semaphore + breaker + cache live
	//    there; this service just provides the inputs and writes the output.
	const generated = await generateWeakSpotDiagnosis(
		fields.word,
		fields.reading,
		fields.meaning,
		card.lapses,
		recentRatings,
		profile.jlpt_target ?? "N5",
		profile.native_language,
	);

	// 7. Persist the diagnosis + prescription onto the weakSpot row. Only updates
	//    the two text columns; FSRS state and resolution status are untouched.
	const { error: updateError } = await supabaseAdmin
		.from("weak_spots")
		.update({
			diagnosis: generated.diagnosis,
			prescription: generated.prescription,
		})
		.eq("id", weakSpotId)
		.eq("user_id", userId);

	if (updateError !== null) {
		log.error({ weakSpotId, err: { message: updateError.message, code: updateError.code } }, "diagnoseWeakSpot update failed");
		throw dbError("persist weakSpot diagnosis", updateError);
	}

	// 8. Return the full joined detail so the client can drop the response into
	//    its TanStack Query cache directly. Same shape as GET /:id.
	return getWeakSpotById(userId, weakSpotId);
}

// ─── Batch diagnose for session (audit-remediation: feature 1) ──────────────
//
// Walks every weak spot attached to a session, fires `diagnoseWeakSpot` on
// any that don't have a diagnosis yet, and reports a tally. Used by the
// review-summary surface to populate per-row diagnoses without inflating
// `processReview`'s latency on every rating.
//
// Concurrency is bounded by `openaiSemaphore` inside each call — the
// `Promise.allSettled` here just lets independent diagnoses run in
// parallel without one failure blocking the rest.

const BatchDiagnoseWeakSpotRowSchema = z.object({
	id: z.string(),
});

export interface BatchDiagnoseResult {
	diagnosed: number;
	skipped: number;
	failed: number;
}

/**
 * Diagnoses every undiagnosed weak spot in a session in one operation.
 *
 * Returns a tally; the per-row diagnoses are stored in the `weak_spots`
 * table and surface on the next `getSessionSummary` fetch.
 *
 * Errors per individual weak spot are logged + counted, not rethrown.
 * The endpoint should still return 200 even when some AI calls fail —
 * partial success is the expected steady state for a network-dependent
 * batch operation.
 */
export async function batchDiagnoseForSession(
	userId: string,
	sessionId: string,
): Promise<BatchDiagnoseResult> {
	// 1. Find weak spots in this session that don't have a diagnosis yet.
	//    `diagnosis IS NULL` is the gate: existing diagnoses are sticky and
	//    only refreshed via an explicit per-row re-diagnose (not exposed yet).
	const { data: rows, error } = await supabaseAdmin
		.from("weak_spots")
		.select("id")
		.eq("user_id", userId)
		.eq("session_id", sessionId)
		.is("diagnosis", null);

	if (error !== null) {
		throw dbError("fetch session weak spots for batch diagnose", error);
	}

	const ids = z.array(BatchDiagnoseWeakSpotRowSchema).parse(rows ?? []).map(r => r.id);

	if (ids.length === 0) {
		return { diagnosed: 0, skipped: 0, failed: 0 };
	}

	// 2. Fire diagnoses in parallel. `diagnoseWeakSpot` internally bounds
	//    OpenAI concurrency via `openaiSemaphore` (ai.service.ts), so we
	//    don't need a second semaphore here — let allSettled drive parallel
	//    invocations and the semaphore inside each call serializes the
	//    actual API hits to the configured concurrency cap.
	// The diagnosis voice (JLPT target + native language) is identical for every
	// weak spot in the session, so fetch it once here and hand it to each
	// diagnoseWeakSpot call rather than letting all N calls re-read the same
	// profile row. A prefetch failure degrades to undefined → each call falls
	// back to its own fetch (and ultimately safe defaults).
	const { data: profileRow, error: profileError } = await supabaseAdmin
		.from("profiles")
		.select("jlpt_target, native_language")
		.eq("id", userId)
		.maybeSingle();
	if (profileError !== null) {
		log.warn({ userId, sessionId, err: { message: profileError.message, code: profileError.code } }, "batchDiagnoseForSession profile prefetch failed; per-row calls will fall back");
	}
	const sharedProfile = profileRow !== null
		? ProfileForDiagnosisSchema.parse(profileRow)
		: undefined;

	const settled = await Promise.allSettled(
		ids.map(id => diagnoseWeakSpot(userId, id, sharedProfile !== undefined ? { profile: sharedProfile } : undefined)),
	);

	let diagnosed = 0;
	let failed = 0;
	for (const result of settled) {
		if (result.status === "fulfilled") {
			diagnosed += 1;
		} else {
			failed += 1;
			const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
			log.warn({ userId, sessionId, err: { message } }, "batchDiagnoseForSession: per-row diagnose failed");
		}
	}

	return { diagnosed, skipped: 0, failed };
}
