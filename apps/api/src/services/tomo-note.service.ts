import type { ApiTomoNote, FieldsData } from "@fsrs-japanese/shared-types";
import { createHash } from "node:crypto";
import {
	getWordFields,
	JLPTLevel,

} from "@fsrs-japanese/shared-types";

import { z } from "zod";
import idiomsFile from "../data/idioms.json" with { type: "json" };
import { supabaseAdmin } from "../db/supabase.ts";
import { componentLogger } from "../lib/logger.ts";
import { normalizeTimeZone } from "../lib/timezone.ts";
import { AppError, ServiceUnavailableError } from "../middleware/errorHandler.ts";
import { generateTomoNote } from "./ai.service.ts";
import * as profileService from "./profile.service.ts";
import * as reviewService from "./review.service.ts";

// JLPTLevel from shared-types is both a const and a type alias. Locally we
// only need the type for nullable parameters; alias to keep the call sites
// readable.
type JLPTLevelType = JLPTLevel;

const log = componentLogger("tomo-note.service");

// ─── Curated idiom catalogue (Stage 6 fallback) ───────────────────────────────
//
// Loaded from `../data/idioms.json` at module load. JSON schema is enforced
// here via Zod so a malformed edit to the static file surfaces as a clean
// module-load failure rather than a runtime crash inside the request path.

const IdiomEntrySchema = z.object({
	body: z.string().min(1),
});

// The static JSON file may carry a `$schema` doc-comment key alongside the
// JLPT-keyed arrays. We strip it on parse with `passthrough` and then narrow
// to the six known levels for the lookup map. Locking to a concrete type
// alias here (vs `z.infer`) keeps `IDIOM_CATALOGUE[key]` returning a typed
// `IdiomEntry[]` rather than the widened `unknown` that `passthrough` would
// otherwise produce.
type IdiomEntry = z.infer<typeof IdiomEntrySchema>;
interface IdiomCatalogue {
	N5: IdiomEntry[];
	N4: IdiomEntry[];
	N3: IdiomEntry[];
	N2: IdiomEntry[];
	N1: IdiomEntry[];
	beyond_jlpt: IdiomEntry[];
}

const IdiomCatalogueSchema = z.object({
	N5: z.array(IdiomEntrySchema).min(1),
	N4: z.array(IdiomEntrySchema).min(1),
	N3: z.array(IdiomEntrySchema).min(1),
	N2: z.array(IdiomEntrySchema).min(1),
	N1: z.array(IdiomEntrySchema).min(1),
	beyond_jlpt: z.array(IdiomEntrySchema).min(1),
}).passthrough();

const IDIOM_CATALOGUE: IdiomCatalogue = (() => {
	const parsed = IdiomCatalogueSchema.parse(idiomsFile);
	// Re-narrow to the strict catalogue shape, dropping any passthrough keys
	// like `$schema`. The cast is safe because Zod has already validated the
	// six required arrays at parse time.
	return {
		N5: parsed.N5,
		N4: parsed.N4,
		N3: parsed.N3,
		N2: parsed.N2,
		N1: parsed.N1,
		beyond_jlpt: parsed.beyond_jlpt,
	};
})();

const ALL_JLPT_LEVELS = [
	JLPTLevel.N5,
	JLPTLevel.N4,
	JLPTLevel.N3,
	JLPTLevel.N2,
	JLPTLevel.N1,
	JLPTLevel.BeyondJLPT,
] as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const ProfileRowSchema = z.object({
	timezone: z.string(),
	jlpt_target: z.string().nullable(),
	native_language: z.string(),
});

const InterestRowSchema = z.object({ interest: z.string() });

const HeatmapRowSchema = z.object({
	date: z.string(),
	retention: z.coerce.number(),
	count: z.coerce.number(),
});

/**
 * Computes a YYYY-MM-DD calendar date for the given timezone. Uses
 * `Intl.DateTimeFormat` with `en-CA` because that locale's `dateStyle: short`
 * is the ISO date format — no fragile manual padding.
 */
export function todayDateKey(timeZone: string): string {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	// en-CA renders 2026-05-17. Other locales would render 5/17/2026 etc.
	return formatter.format(new Date());
}

/** YYYY-MM-DD shifted back one day from the given dateKey. Pure string arithmetic. */
export function yesterdayDateKey(dateKey: string): string {
	// Use UTC math against the date portion only; we never read time-of-day
	// from this value, so DST doesn't apply.
	const d = new Date(`${dateKey}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 1);
	return d.toISOString().slice(0, 10);
}

/**
 * Picks one idiom from the catalogue, deterministically by (userId, dateKey)
 * hash. Same user + same day → same idiom across retries. Different days for
 * the same user rotate naturally.
 *
 * Falls back to N3 when the jlpt-target is null or unrecognised — N3 is the
 * mid-range default in this codebase (matches the prompt's `'N5'` default
 * in card.controller.ts:75).
 */
export function pickIdiomBody(
	userId: string,
	dateKey: string,
	jlptTarget: JLPTLevelType | null,
): string {
	const levelKey: keyof IdiomCatalogue = ((): keyof IdiomCatalogue => {
		if (jlptTarget !== null && (ALL_JLPT_LEVELS as readonly string[]).includes(jlptTarget)) {
			// beyond_jlpt is the enum value; the JSON key matches.
			return jlptTarget as keyof IdiomCatalogue;
		}
		return "N3";
	})();

	const pool = IDIOM_CATALOGUE[levelKey];
	const hash = createHash("sha256").update(`${userId}:${dateKey}`).digest();
	// Read the first 4 bytes as an unsigned int → bound to pool length.
	const index = hash.readUInt32BE(0) % pool.length;
	// The Zod parse at module load enforces `z.array(...).min(1)` on every
	// JLPT level, so `pool[index]` is always defined for an index in
	// [0, pool.length). The string fallback satisfies noUncheckedIndexedAccess
	// without a non-null assertion; the empty-string branch is unreachable
	// by construction.
	return pool[index]?.body ?? "";
}

// Slim weak-spot → card join used to surface the learner's current trouble
// words in the morning note. Parsed per-row with safeParse so a relationship
// that comes back unexpectedly shaped degrades to "no words" rather than
// throwing inside the request path.
const TomoWeakSpotRowSchema = z.object({
	card: z.object({
		fields_data: z.record(z.string(), z.unknown()),
		layout_type: z.enum(["vocabulary", "grammar", "sentence"]),
	}).nullable(),
});

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Returns one Tomo daily note for the learner. Cost-bounded to one AI call
 * per learner per day via the generator's Redis cache (key includes the
 * learner-local `dateKey`).
 *
 * Backend Completion Plan Stage 6.
 *
 * If the AI path is unavailable (open chat breaker, missing OpenAI key,
 * empty / malformed model response, or any other generator failure), a
 * curated idiom is returned with `kind: 'idiom'`. The route is built around
 * the invariant that this endpoint never surfaces a 5xx to the client —
 * the staging UI must always have copy to render.
 */
export async function getTomoNote(userId: string): Promise<ApiTomoNote> {
	// Step 1 — load learner profile (timezone, JLPT target, native language).
	// A 404 here is genuine: the user is authenticated but their profile row
	// is missing, which shouldn't happen post-signup. Surface as an AppError
	// so the route handler can convert to HTTP 404. Profile failures are NOT
	// routed to the idiom fallback because they aren't AI failures.
	const { data: profileData, error: profileError } = await supabaseAdmin
		.from("profiles")
		.select("timezone, jlpt_target, native_language")
		.eq("id", userId)
		.single();

	if (profileError !== null || profileData === null) {
		throw new AppError(404, "Profile not found", { code: "PROFILE_NOT_FOUND" });
	}
	const profile = ProfileRowSchema.parse(profileData);

	const timeZone = normalizeTimeZone(profile.timezone);
	const dateKey = todayDateKey(timeZone);
	const jlptTarget = profile.jlpt_target as JLPTLevelType | null;

	// Step 2 — load interests (small bounded set; one parallel SELECT). A
	// failure here degrades silently to an empty array — interests are
	// optional flavour, not a correctness requirement.
	const interestsPromise = supabaseAdmin
		.from("user_interests")
		.select("interest")
		.eq("user_id", userId)
		.then((res) => {
			if (res.error !== null) {
				log.warn({ userId, err: { message: res.error.message } }, "failed to load user_interests; falling back to empty");
				return [] as string[];
			}
			return z.array(InterestRowSchema).parse(res.data ?? []).map(r => r.interest);
		});

	// Step 3 — load yesterday's review-count + retention via get_heatmap_data.
	// The RPC is timezone-aware (Stage learner_timezone_review_buckets). If
	// yesterday isn't in the heatmap, the learner didn't review yesterday;
	// pass nulls to the prompt and the system message tells the model how
	// to handle that case.
	const heatmapPromise = supabaseAdmin
		.rpc("get_heatmap_data", { p_user_id: userId, p_timezone: timeZone })
		.then((res) => {
			if (res.error !== null) {
				log.warn({ userId, err: { message: res.error.message } }, "failed to load heatmap; yesterday stats will be null");
				return null;
			}
			const rows = z.array(HeatmapRowSchema).parse(res.data ?? []);
			const yKey = yesterdayDateKey(dateKey);
			return rows.find(r => r.date === yKey) ?? null;
		});

	// Step 3b — due-today count from the source of truth (get_due_cards via the
	// review service, which is itself cached). Lets the morning note orient the
	// learner to the session ahead. Degrades to null on any failure so the note
	// simply omits the line rather than failing.
	const dueTodayPromise: Promise<number | null> = profileService.getProfileCached(userId)
		.then(p => reviewService.getDueCards(userId, p))
		.then(list => list.items.length)
		.catch((err: unknown) => {
			log.warn({ userId, err: { message: err instanceof Error ? err.message : String(err) } }, "failed to load due count for tomo note; omitting");
			return null;
		});

	// Step 3c — current unresolved weak-spot words (most recent first). Degrades
	// to an empty list on any failure; words are flavour, not correctness.
	// PromiseLike, not Promise: supabase-js builders are thenables (no .catch).
	const weakSpotWordsPromise: PromiseLike<string[]> = supabaseAdmin
		.from("weak_spots")
		.select("card:cards(fields_data, layout_type)")
		.eq("user_id", userId)
		.eq("resolved", false)
		.order("created_at", { ascending: false })
		.limit(5)
		.then((res) => {
			if (res.error !== null) {
				log.warn({ userId, err: { message: res.error.message } }, "failed to load weak spots for tomo note; omitting");
				return [] as string[];
			}
			return (res.data ?? [])
				.map(r => TomoWeakSpotRowSchema.safeParse(r))
				.flatMap(p => (p.success && p.data.card !== null ? [p.data.card] : []))
				.map(c => getWordFields({ layoutType: c.layout_type, fieldsData: c.fields_data as FieldsData })?.word)
				.filter((w): w is string => typeof w === "string" && w.length > 0);
		});

	const [interests, yesterdayRow, dueToday, weakSpotWords] = await Promise.all([
		interestsPromise,
		heatmapPromise,
		dueTodayPromise,
		weakSpotWordsPromise,
	]);
	const yesterdayReviews: number | null = yesterdayRow?.count ?? null;
	const yesterdayRetention: number | null = yesterdayRow?.retention ?? null;

	// Step 4 — generate. On any AI failure, fall back to a curated idiom. The
	// breaker-open case surfaces here as `ServiceUnavailableError` (a subclass
	// of AppError). Catching `unknown` instead of just that class is
	// intentional: a ZodError from structured-output validation, an
	// `OPENAI_KEY_MISSING` AppError, or a raw network error all warrant the
	// same fallback — the route's invariant is that this endpoint always
	// returns 200 with renderable copy.
	try {
		const generated = await generateTomoNote(
			userId,
			dateKey,
			jlptTarget ?? "N5",
			profile.native_language,
			interests,
			yesterdayReviews,
			yesterdayRetention,
			dueToday,
			weakSpotWords,
		);
		return { body: generated.body, kind: "insight", dateKey };
	} catch (err) {
		if (err instanceof ServiceUnavailableError) {
			log.warn({ userId, dateKey }, "AI breaker open; serving curated idiom fallback");
		} else if (err instanceof AppError && err.code === "OPENAI_KEY_MISSING") {
			// Dev / preview deploys without OPENAI_API_KEY set. Log once at info
			// (not error) so test runs aren't noisy.
			log.info({ userId, dateKey }, "OPENAI_API_KEY missing; serving curated idiom fallback");
		} else {
			// Genuine generator failure — log at error so monitoring catches it,
			// but still serve the idiom so the UI renders.
			const message = err instanceof Error ? err.message : String(err);
			log.error({ userId, dateKey, err: { message } }, "generateTomoNote failed; serving curated idiom fallback");
		}
		const body = pickIdiomBody(userId, dateKey, jlptTarget);
		return { body, kind: "idiom", dateKey };
	}
}
