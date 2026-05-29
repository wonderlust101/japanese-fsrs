import type { ApiWeakSpotListItem, ApiWeakSpotListResponse } from "@fsrs-japanese/shared-types";
import type { ListWeakSpotsQuery } from "../schemas/weak-spot.schema.ts";
import { z } from "zod";
import { supabaseAdmin } from "../db/supabase.ts";
import { componentLogger } from "../lib/logger.ts";
import { AppError, dbError } from "../middleware/errorHandler.ts";
import { toListItem, WEAK_SPOT_SELECT_INNER, WEAK_SPOT_SELECT_LEFT, WeakSpotRowSchema } from "./weak-spot.shared.ts";

// Drill-session + diagnosis services are split into sibling modules but
// re-exported here so `import * as weakSpotService` keeps resolving every
// function from one path.
export * from "./weak-spot-diagnosis.service.ts";
export * from "./weak-spot-drill.service.ts";
export { toListItem } from "./weak-spot.shared.ts";
export type { WeakSpotRow } from "./weak-spot.shared.ts";

const log = componentLogger("weakSpot.service");

export async function listWeakSpots(
	userId: string,
	params: ListWeakSpotsQuery,
): Promise<ApiWeakSpotListResponse> {
	const { status, deckId, jlptLevel, diagnosis, sort, sortDir, limit, offset } = params;
	const searchTerm = params.search?.trim() ?? "";
	const hasSearch = searchTerm.length > 0;

	// Resolve the primary sort direction: an explicit `sortDir` overrides the
	// mode's natural default (newest / most lapses first → descending; oldest /
	// first-deck → ascending). The client surfaces this as a direction toggle.
	const naturalAscending = sort === "oldestUnresolved" || sort === "deckOrder";
	const primaryAscending
		= sortDir === "asc" ? true : sortDir === "desc" ? false : naturalAscending;

	// Card-side filters force an inner join so non-matching cards drop the
	// parent weakSpot rather than surface with `card: null`. Orphans (card_id IS
	// NULL) are dropped naturally when any card filter is applied — that's the
	// desired behavior since the user is asking "which weakSpots match this
	// deck/JLPT/etc."
	//
	// The `diagnosis` filter is intentionally NOT part of hasCardFilter — it
	// lives on `weakSpots`, not on `cards`. Forcing inner-join because of it
	// would incorrectly drop orphan weakSpots (card_id NULL) where a diagnosis
	// was recorded before the card was deleted.
	// Search also targets the joined card, so it forces the inner join for the
	// same reason the deck/JLPT filters do: a free-text query is asking "which
	// weakSpots have a card matching this text", and orphan rows (card_id NULL)
	// can never match. Embedded-resource filters only drop the *parent* row
	// under `!inner`; under a LEFT join they'd merely null the embed.
	const hasCardFilter = deckId !== undefined || jlptLevel !== undefined || hasSearch;
	const selectStr = hasCardFilter ? WEAK_SPOT_SELECT_INNER : WEAK_SPOT_SELECT_LEFT;

	// `count: 'exact'` makes the awaited result carry the full match count
	// alongside the page window, so the client can render numbered pagination.
	// `.range()` is inclusive on both ends, hence `offset + limit - 1`.
	let q = supabaseAdmin
		.from("weak_spots")
		.select(selectStr, { count: "exact" })
		.eq("user_id", userId)
		.eq("resolved", status === "resolved")
		.range(offset, offset + limit - 1);

	if (deckId !== undefined)
		q = q.eq("card.deck_id", deckId);
	if (jlptLevel !== undefined)
		q = q.eq("card.jlpt_level", jlptLevel);

	if (diagnosis === "available") {
		// PostgREST compiles `.not('diagnosis', 'is', null)` to `diagnosis IS NOT NULL`.
		q = q.not("diagnosis", "is", null);
	} else if (diagnosis === "missing") {
		q = q.is("diagnosis", null);
	}

	// ── Free-text search ──
	// ILIKE across the joined card's word / reading / meaning JSONB fields. The
	// `referencedTable: 'card'` option scopes the OR group to the embedded card
	// relation (the select alias is `card:cards`). The pattern is wrapped in
	// double quotes so spaces or punctuation in the term can't break PostgREST's
	// comma/paren-delimited or() grammar; embedded quotes/backslashes are
	// stripped first since they'd terminate the quoted value.
	if (hasSearch) {
		// Two escaping layers protect this interpolated filter value:
		//   1. Strip backslash and double-quote — both are special inside
		//      PostgREST's double-quoted `.or()` value (one escapes, one
		//      terminates), so a raw occurrence would corrupt the filter grammar.
		//   2. Escape the SQL LIKE wildcards `%` and `_` so a learner typing them
		//      is matched literally instead of turning the term into a match-all /
		//      match-any-char scan (a mild scan-amplification vector). The escape
		//      is DOUBLED (`\\`) on purpose: inside a PostgREST double-quoted value
		//      `\\` collapses to a single `\`, which is Postgres LIKE's default
		//      escape char, so the metachar reaches ILIKE as `\%` / `\_` (literal).
		//      PostgREST's own `*` wildcard maps to `%` separately, so a `*` in the
		//      term stays a wildcard — that is out of scope for this guard.
		//      NOTE: unit tests mock Supabase, so this escaping needs a live
		//      PostgREST smoke test to confirm the deployed version's quoted-value
		//      handling matches the assumption above.
		const safe = searchTerm
			.replace(/[\\"]/g, "")
			.replace(/[%_]/g, "\\\\$&");
		const pattern = `"*${safe}*"`;
		q = q.or(
			[
				`fields_data->>word.ilike.${pattern}`,
				`fields_data->>reading.ilike.${pattern}`,
				`fields_data->>meaning.ilike.${pattern}`,
			].join(","),
			{ referencedTable: "card" },
		);
	}

	// ── Ordering ──
	// `mostRecent` and `oldestUnresolved` are the same axis (created_at) at
	// opposite directions; both honour `primaryAscending` so the client's single
	// "Date flagged" axis + direction toggle maps onto either. The id tiebreaker
	// tracks the primary direction to keep keyset order total.
	if (sort === "mostRecent" || sort === "oldestUnresolved") {
		q = q
			.order("created_at", { ascending: primaryAscending })
			.order("id", { ascending: primaryAscending });
	} else if (sort === "mostLapses") {
		// `foreignTable` orders by the joined cards row; nullsFirst:false keeps
		// orphan weakSpots (card row absent) at the end of the list.
		q = q
			.order("lapses", { ascending: primaryAscending, nullsFirst: false, foreignTable: "cards" })
			.order("created_at", { ascending: false })
			.order("id", { ascending: false });
	} else {
		// deckOrder. Groups adjacent weakSpots by deck. Across decks the order is
		// by deck UUID (deterministic but not alphabetical) — that's an acceptable
		// trade for avoiding an extra join just to sort on deck.name. In practice
		// this sort is most useful paired with a deckId filter, where intra-deck
		// ordering matters and inter-deck ordering doesn't.
		q = q
			.order("deck_id", { ascending: primaryAscending, foreignTable: "cards" })
			.order("created_at", { ascending: false })
			.order("id", { ascending: false });
	}

	const { data, error, count } = await q;

	if (error !== null) {
		throw dbError("list weakSpots", error);
	}

	const rows = z.array(WeakSpotRowSchema).parse(data ?? []);
	const items = rows.map(toListItem);

	return { items, totalCount: count ?? 0 };
}

/**
 * Returns a single weakSpot with full joined context, or throws 404 if the row
 * does not exist for the authenticated user. The query filters by user_id in
 * SQL — RLS would also block cross-user reads, but we use the service-role
 * client so explicit filtering is the only safety belt.
 */
export async function getWeakSpotById(userId: string, id: string): Promise<ApiWeakSpotListItem> {
	const { data, error } = await supabaseAdmin
		.from("weak_spots")
		.select(WEAK_SPOT_SELECT_LEFT)
		.eq("id", id)
		.eq("user_id", userId)
		.maybeSingle();

	if (error !== null) {
		log.error({ weakSpotId: id, err: { message: error.message, code: error.code } }, "getWeakSpotById query failed");
		throw dbError("fetch weakSpot", error);
	}
	if (data === null) {
		throw new AppError(404, "WeakSpot not found", { code: "WEAK_SPOT_NOT_FOUND" });
	}

	return toListItem(WeakSpotRowSchema.parse(data));
}

// ─── Write path (Stage 2) ─────────────────────────────────────────────────────
//
// Slim projection used by the pre-fetch step of resolveWeakSpot / reopenWeakSpot.
// We only need to know the row's current state to decide between:
//   - 404 (row missing or wrong owner)
//   - idempotent return (already in target state)
//   - real UPDATE (state needs flipping)
// Keeping the projection minimal here avoids paying for the full joined
// payload on the idempotent path; the post-update select brings back the
// WEAK_SPOT_SELECT_LEFT shape so callers always get the same response as
// getWeakSpotById.

const WeakSpotStateRowSchema = z.object({
	id: z.string().uuid(),
	resolved: z.boolean(),
	resolved_at: z.string().nullable(),
});

async function fetchWeakSpotState(userId: string, id: string): Promise<z.infer<typeof WeakSpotStateRowSchema>> {
	const { data, error } = await supabaseAdmin
		.from("weak_spots")
		.select("id, resolved, resolved_at")
		.eq("id", id)
		.eq("user_id", userId)
		.maybeSingle();

	if (error !== null) {
		log.error({ weakSpotId: id, err: { message: error.message, code: error.code } }, "fetchWeakSpotState query failed");
		throw dbError("fetch weakSpot", error);
	}
	if (data === null) {
		// Same 404 shape as getWeakSpotById for cross-user attempts — does not leak
		// existence to other users.
		throw new AppError(404, "WeakSpot not found", { code: "WEAK_SPOT_NOT_FOUND" });
	}
	return WeakSpotStateRowSchema.parse(data);
}

async function fetchWeakSpotJoined(userId: string, id: string): Promise<ApiWeakSpotListItem> {
	// Reads the row we just mutated. .single() is the right terminal here:
	// the row provably exists (we just confirmed it in the pre-fetch and the
	// UPDATE returned without 404 conditions), so a null result would be a
	// genuine 500-class anomaly worth surfacing as such.
	const { data, error } = await supabaseAdmin
		.from("weak_spots")
		.select(WEAK_SPOT_SELECT_LEFT)
		.eq("id", id)
		.eq("user_id", userId)
		.single();

	if (error !== null) {
		log.error({ weakSpotId: id, err: { message: error.message, code: error.code } }, "fetchWeakSpotJoined query failed");
		throw dbError("refetch weakSpot", error);
	}
	return toListItem(WeakSpotRowSchema.parse(data));
}

/**
 * Marks a weakSpot as resolved. Idempotent: resolving an already-resolved weakSpot
 * returns the row unchanged so the original `resolved_at` (the moment the
 * learner actually closed the loop) is preserved across accidental retries.
 *
 * Two round-trips:
 *   1) State pre-fetch — 404 cleanly when missing or cross-user; short-circuit
 *      to a joined fetch when already in the target state.
 *   2) UPDATE — flips resolved + stamps resolved_at, then the joined refetch
 *      returns the same shape as getWeakSpotById so callers can drop the
 *      response directly into their cache.
 */
export async function resolveWeakSpot(userId: string, id: string): Promise<ApiWeakSpotListItem> {
	const current = await fetchWeakSpotState(userId, id);

	if (current.resolved) {
		// Already resolved — return the existing joined payload without writing.
		return fetchWeakSpotJoined(userId, id);
	}

	const { error } = await supabaseAdmin
		.from("weak_spots")
		.update({ resolved: true, resolved_at: new Date().toISOString() })
		.eq("id", id)
		.eq("user_id", userId);

	if (error !== null) {
		throw dbError("resolve weakSpot", error);
	}

	return fetchWeakSpotJoined(userId, id);
}

/**
 * Reopens a previously-resolved weakSpot.
 *
 * Idempotent on the happy path; throws 409 WEAK_SPOT_ALREADY_OPEN when another
 * unresolved weakSpot for the same (card_id, user_id) already exists. That
 * conflict is enforced at the DB layer by the partial unique index
 * `weak_spots_card_user_unresolved_idx` (originally `leeches_card_user_unresolved_idx`, migration 20260425000001) — we catch
 * SQLSTATE 23505 from the UPDATE and translate it before it falls through to
 * the generic `dbError` mapper. A pre-check would race; the only correct
 * pattern is "UPDATE optimistically, catch 23505, translate to 409".
 */
export async function reopenWeakSpot(userId: string, id: string): Promise<ApiWeakSpotListItem> {
	const current = await fetchWeakSpotState(userId, id);

	if (!current.resolved) {
		// Already open — return the existing joined payload without writing.
		return fetchWeakSpotJoined(userId, id);
	}

	const { error } = await supabaseAdmin
		.from("weak_spots")
		.update({ resolved: false, resolved_at: null })
		.eq("id", id)
		.eq("user_id", userId);

	if (error !== null) {
		if (typeof error === "object" && "code" in error && error.code === "23505") {
			throw new AppError(
				409,
				"Another unresolved weakSpot exists for this card; resolve it first",
				{ cause: error, code: "WEAK_SPOT_ALREADY_OPEN" },
			);
		}
		throw dbError("reopen weakSpot", error);
	}

	return fetchWeakSpotJoined(userId, id);
}

// ─── Drill sessions (Stage 3) ─────────────────────────────────────────────────
//
// The RPC `create_weak_spot_drill_session` (migration 20260531000000) runs the
// candidate selection, session INSERT, and N snapshot INSERTs inside one
// transaction. The service does not call the FSRS layer and never writes to
// `cards` or `review_logs` — drill is a parallel namespace by design.
