import type { ApiDayReflection } from "@fsrs-japanese/shared-types";
import { createHash } from "node:crypto";
import {
	assertNever,
	classifySession,

} from "@fsrs-japanese/shared-types";

import { z } from "zod";
import { supabaseAdmin } from "../db/supabase.ts";
import { asPayload } from "../lib/db.ts";
import { componentLogger } from "../lib/logger.ts";
import { normalizeTimeZone } from "../lib/timezone.ts";
import { AppError, ServiceUnavailableError } from "../middleware/errorHandler.ts";
import { generateDayReflection } from "./ai.service.ts";
import { getProfileCached } from "./profile.service.ts";
import { yesterdayDateKey } from "./tomo-note.service.ts";

const log = componentLogger("day-reflection.service");

// Prior-day row from get_heatmap_data (count + retention per local day).
// Mirrors the shape tomo-note.service parses; retention is already 0–100.
const HeatmapRowSchema = z.object({
	date: z.string(),
	retention: z.coerce.number(),
	count: z.coerce.number(),
});

// Envelope returned by the `get_day_review_aggregate` RPC (migration
// 20260627000000). Locked to a Zod schema at the service boundary so any
// drift from the SQL surfaces as a clean parse error rather than a runtime
// undefined in the prompt assembly.
const AggregateEnvelopeSchema = z.object({
	date_key: z.string(),
	session_ids: z.array(z.string()),
	session_count: z.number().int().nonnegative(),
	total_cards: z.number().int().nonnegative(),
	total_time_ms: z.number().int().nonnegative(),
	breakdown: z.object({
		again: z.number().int().nonnegative(),
		hard: z.number().int().nonnegative(),
		good: z.number().int().nonnegative(),
		easy: z.number().int().nonnegative(),
	}),
	weak_spot_words: z.array(z.string()),
});

/**
 * SHA-256 fingerprint of the day's session-ID set, sorted for determinism.
 * The cache key in the AI generator includes this fingerprint, so adding a
 * new session to the day naturally invalidates the previous cache entry
 * and triggers a fresh generation that incorporates the new session's data.
 */
function fingerprintSessions(sessionIds: readonly string[]): string {
	const sorted = [...sessionIds].sort();
	return createHash("sha256").update(sorted.join("|")).digest("hex").slice(0, 12);
}

/**
 * Rule-based fallback prose used when the AI generator is unavailable
 * (breaker open, missing key, empty response, schema drift, …). Delegates
 * pattern classification to the shared `classifySession` so the backend
 * fallback and the frontend's rule-based prose can never disagree on
 * which pattern a given metric shape produces. The per-pattern prose
 * lookup below stays terse on purpose — fallback copy doesn't need the
 * longer rationale the UI's `summary-pattern.ts` carries.
 */
function ruleBasedReflection(args: {
	totalCards: number;
	accuracyPct: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
	weakSpotCount: number;
}): string {
	const pattern = classifySession({
		totalCards: args.totalCards,
		accuracyPct: args.accuracyPct,
		again: args.again,
		hard: args.hard,
		good: args.good,
		easy: args.easy,
		weakSpotCount: args.weakSpotCount,
		endedEarly: false,
	});
	switch (pattern) {
		case "no-pattern": return "Short session today. Not enough cards to call a pattern.";
		case "weakSpot": return "A handful of cards keep slipping. They look like weak spots.";
		case "difficult": return "Recall sat lower than usual. A short focused drill will help.";
		case "strong": return "No clear weak spot today.";
		case "ended-early": return "A short stop is fine; the rough spots will come back around.";
		case "mixed": return "A few rough spots, nothing alarming.";
		default: return assertNever(pattern);
	}
}

// Durable row shape for `day_reflections` (migration 20260712000000). `source`
// mirrors the table's CHECK; `fingerprint` is compared against the current
// day's session-set fingerprint to decide serve-stored vs. regenerate.
const StoredReflectionRowSchema = z.object({
	body: z.string(),
	source: z.enum(["ai", "fallback"]),
	fingerprint: z.string(),
});

/**
 * Upserts the generated reflection into `day_reflections` (keyed user+date).
 * Best-effort: a write failure is logged but never fails the request — the
 * caller already holds the body to return, and the next read just regenerates.
 */
async function persistDayReflection(args: {
	userId: string;
	dateKey: string;
	body: string;
	source: "ai" | "fallback";
	fingerprint: string;
	sessionCount: number;
}): Promise<void> {
	const { error } = await supabaseAdmin
		.from("day_reflections")
		.upsert({
			user_id: args.userId,
			date_key: args.dateKey,
			body: args.body,
			source: args.source,
			fingerprint: args.fingerprint,
			session_count: args.sessionCount,
		}, { onConflict: "user_id,date_key" });
	if (error !== null) {
		log.warn({ userId: args.userId, dateKey: args.dateKey, err: { code: error.code, message: error.message } }, "day_reflections upsert failed; result still returned");
	}
}

/**
 * Returns one Tomo-voice reflection over the user's review work for the
 * local calendar day that contains the given session. Aggregates ALL
 * sessions on that date; regenerates whenever a new session is added
 * (the session-IDs fingerprint changes → cache miss).
 *
 * Failure modes:
 *   - Profile missing → 404 PROFILE_NOT_FOUND
 *   - Session missing → 404 SESSION_NOT_FOUND
 *   - AI breaker open / key missing / empty / Zod failure → returns the
 *     `source: 'fallback'` rule-based prose. The endpoint never surfaces
 *     a 5xx for content-availability reasons — the Session details card
 *     must always have a body to render.
 */
export async function getDayReflection(
	sessionId: string,
	userId: string,
): Promise<ApiDayReflection> {
	// 1) Load profile (timezone, JLPT target, native language) through the
	//    shared cached read, so the summary view's profile reads collapse to
	//    ≤1 DB hit. Still throws 404 PROFILE_NOT_FOUND on a missing row.
	const profile = await getProfileCached(userId);
	const timeZone = normalizeTimeZone(profile.timezone);

	// 2) Aggregate the day's review work via the new RPC. SECURITY DEFINER +
	//    user-bound filters inside the function; the service-role key here
	//    is the standard pattern for `get_*` RPCs.
	const { data, error } = await supabaseAdmin.rpc(
		"get_day_review_aggregate",
		asPayload({
			p_session_id: sessionId,
			p_user_id: userId,
			p_timezone: timeZone,
		}),
	);
	if (error !== null) {
		const isSessionNotFound
			= error.code === "P0002" || error.code === "02000"
				|| error.message.includes("session_not_found");
		if (isSessionNotFound) {
			throw new AppError(404, "Session not found", { code: "SESSION_NOT_FOUND" });
		}
		log.error({ userId, sessionId, err: { code: error.code, message: error.message } }, "get_day_review_aggregate failed");
		throw new AppError(500, "Failed to load day aggregate", { code: "DAY_AGGREGATE_FAILED" });
	}
	const agg = AggregateEnvelopeSchema.parse(data);

	const accuracyPct = agg.total_cards === 0
		? 0
		: Math.round(((agg.breakdown.good + agg.breakdown.easy) / agg.total_cards) * 1000) / 10;

	// 3) Durable read (migration 20260712000000): serve the stored row with
	//    zero AI cost when it exists AND its fingerprint matches the current
	//    session set. A new same-day session changes the fingerprint and forces
	//    a regenerate below. A read error degrades to regeneration — it never
	//    fails the endpoint.
	const fingerprint = fingerprintSessions(agg.session_ids);
	const { data: storedRow, error: readError } = await supabaseAdmin
		.from("day_reflections")
		.select("body, source, fingerprint")
		.eq("user_id", userId)
		.eq("date_key", agg.date_key)
		.maybeSingle();
	if (readError !== null) {
		log.warn({ userId, dateKey: agg.date_key, err: { code: readError.code, message: readError.message } }, "day_reflections read failed; regenerating");
	} else if (storedRow !== null) {
		const parsed = StoredReflectionRowSchema.parse(storedRow);
		if (parsed.fingerprint === fingerprint) {
			return { body: parsed.body, source: parsed.source, dateKey: agg.date_key, sessionCount: agg.session_count };
		}
	}

	// 4) Generate (AI with rule-based fallback), then persist so the next read
	//    — including the one the session-close precompute warms — is a row hit.
	//    The `source` tag lets the UI subtly indicate provenance.
	// Prior-day signal for the reflection's comparison line. Best-effort: a
	// failure or no-activity-yesterday degrades to nulls and the prompt omits
	// the line. Only fetched on the generate path (after the stored-row miss).
	const yKey = yesterdayDateKey(agg.date_key);
	const { yesterdayReviews, yesterdayRetention } = await supabaseAdmin
		.rpc("get_heatmap_data", { p_user_id: userId, p_timezone: timeZone })
		.then((res) => {
			if (res.error !== null) {
				log.warn({ userId, dateKey: agg.date_key, err: { message: res.error.message } }, "heatmap load failed for day-reflection prior-day line; omitting");
				return { yesterdayReviews: null as number | null, yesterdayRetention: null as number | null };
			}
			const row = z.array(HeatmapRowSchema).parse(res.data ?? []).find(r => r.date === yKey);
			return { yesterdayReviews: row?.count ?? null, yesterdayRetention: row?.retention ?? null };
		});

	let body: string;
	let source: "ai" | "fallback";
	try {
		const generated = await generateDayReflection({
			userId,
			dateKey: agg.date_key,
			fingerprint,
			userLevel: profile.jlptTarget ?? "N5",
			nativeLanguage: profile.nativeLanguage,
			totalCards: agg.total_cards,
			totalTimeMs: agg.total_time_ms,
			accuracyPct,
			breakdown: agg.breakdown,
			sessionCount: agg.session_count,
			weakSpotWords: agg.weak_spot_words,
			yesterdayReviews,
			yesterdayRetention,
		});
		body = generated.body;
		source = "ai";
	} catch (err) {
		if (err instanceof ServiceUnavailableError) {
			log.warn({ userId, dateKey: agg.date_key }, "AI breaker open; serving rule-based day-reflection");
		} else if (err instanceof AppError && err.code === "OPENAI_KEY_MISSING") {
			log.info({ userId, dateKey: agg.date_key }, "OPENAI_API_KEY missing; serving rule-based day-reflection");
		} else {
			const message = err instanceof Error ? err.message : String(err);
			log.error({ userId, dateKey: agg.date_key, err: { message } }, "generateDayReflection failed; serving rule-based day-reflection");
		}
		body = ruleBasedReflection({
			totalCards: agg.total_cards,
			accuracyPct,
			again: agg.breakdown.again,
			hard: agg.breakdown.hard,
			good: agg.breakdown.good,
			easy: agg.breakdown.easy,
			weakSpotCount: agg.weak_spot_words.length,
		});
		source = "fallback";
	}

	await persistDayReflection({
		userId,
		dateKey: agg.date_key,
		body,
		source,
		fingerprint,
		sessionCount: agg.session_count,
	});

	return { body, source, dateKey: agg.date_key, sessionCount: agg.session_count };
}
