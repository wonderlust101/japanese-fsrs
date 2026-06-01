import type { ApiCopyPremadeDeckResult, ApiCrossDeckCardListItem, ApiList, ApiPremadeDeck, FieldsData } from "@fsrs-japanese/shared-types";

import type { ListPremadeDeckCardsQuery, ListPremadeDecksQuery } from "../schemas/premade.schema.ts";
import {
	deckTypeEnum,
	jlptLevelEnum,

} from "@fsrs-japanese/shared-types";
import { z } from "zod";
import { supabaseAdmin } from "../db/supabase.ts";
import { asPayload } from "../lib/db.ts";
import { invalidateDueCache } from "../lib/due-cache.ts";
import { decodeCursor, encodeCursor } from "../lib/http.ts";
import { componentLogger } from "../lib/logger.ts";
import { AppError, dbError } from "../middleware/errorHandler.ts";
import { uuidIdCursorSchema } from "../schemas/common.schema.ts";
import { CardDbRowSchema } from "./card/shared.ts";

const log = componentLogger("premade.service");

// ─── Column projections ───────────────────────────────────────────────────────

const PREMADE_COLUMNS = [
	"id",
	"name",
	"description",
	"deck_type",
	"jlpt_level",
	"domain",
	"card_count",
	"is_active",
	"created_at",
	"updated_at",
].join(", ");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Raw snake_case premade-deck row. Inferred from PremadeDeckListRpcRowSchema
 *  (the schema is shared between the list_premade_decks_paginated RPC and
 *  direct .from('premade_decks') reads).
 */
type PremadeDeckDbRow = z.infer<typeof PremadeDeckListRpcRowSchema>;

// ─── RPC envelope schema ──────────────────────────────────────────────────────
// Mirrors the analytics / review precedent: parse the RPC result so any future
// column drift surfaces as a clean ZodError. Shared with direct
// .from('premade_decks').select(...) reads.
//
// Backend Completion Plan Stage 4 (copy model) dropped `version`; the column
// no longer exists on premade_decks. The schema follows.
const PremadeDeckListRpcRowSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	deck_type: deckTypeEnum,
	jlpt_level: jlptLevelEnum.nullable(),
	domain: z.string().nullable(),
	card_count: z.number(),
	is_active: z.boolean(),
	created_at: z.string(),
	updated_at: z.string(),
});

/**
 * Cursor payload for the premade-decks-list endpoint. The
 *  `list_premade_decks_paginated` RPC re-derives the sort key from the row
 *  pointed to by `id`, so the cursor only needs to carry `id` today. Shared
 *  with card.service.ts and deck.service.ts via `uuidIdCursorSchema` — see
 *  schemas/common.schema.ts.
 */
const premadeListCursorSchema = uuidIdCursorSchema;

// Backend Completion Plan Stage 4 (copy model) envelope. The copy RPC returns
// one row carrying the newly-created deck id and the count of cards cloned
// into it. No subscription junction, no "alreadyExisted" flag — duplicates
// are allowed by design.
const CopyRpcRowSchema = z.object({
	deck_id: z.string(),
	card_count: z.number(),
});

function toPremadeRow(raw: PremadeDeckDbRow): ApiPremadeDeck {
	return {
		id: raw.id,
		name: raw.name,
		description: raw.description,
		deckType: raw.deck_type,
		jlptLevel: raw.jlpt_level,
		domain: raw.domain,
		cardCount: raw.card_count,
		isActive: raw.is_active,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
	};
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns a cursor-paginated list of active premade decks, optionally filtered.
 * Backed by the `list_premade_decks_paginated` RPC (migration 20260522000000).
 * Order: (jlpt_level ASC NULLS LAST, name ASC, id ASC).
 */
export async function listPremadeDecks(
	filters: ListPremadeDecksQuery,
): Promise<ApiList<ApiPremadeDeck>> {
	const cursorId = filters.cursor !== undefined
		? decodeCursor(filters.cursor, premadeListCursorSchema).id
		: null;

	const { data, error } = await supabaseAdmin.rpc("list_premade_decks_paginated", asPayload({
		p_limit: filters.limit + 1,
		p_cursor: cursorId,
		p_deck_type: filters.deckType ?? null,
		p_jlpt_level: filters.jlptLevel ?? null,
		p_domain: filters.domain ?? null,
	}));

	if (error !== null) {
		throw dbError("list premade decks", error);
	}

	const rows = z.array(PremadeDeckListRpcRowSchema).parse(data ?? []);
	const hasMore = rows.length > filters.limit;
	const items = rows.slice(0, filters.limit).map(toPremadeRow);
	const lastId = items[items.length - 1]?.id;

	return {
		items,
		nextCursor: hasMore && lastId !== undefined ? encodeCursor({ id: lastId }) : null,
		hasMore,
	};
}

// ─── Premade card preview ──────────────────────────────────────────────────────
//
// Powers GET /api/v1/premade-decks/:id/cards — the read-only catalogue preview
// that lets a learner browse a premade deck's contents *before* copying it.
// Premade source cards carry `premade_deck_id` (and `deck_id IS NULL`, by the
// `cards_deck_xor_premade` XOR constraint), so the user-scoped cross-deck
// listing — which joins the caller's own decks — never returns them. The cards
// RLS policy already permits reading them (`auth.uid() = user_id OR user_id IS
// NULL`); this is just the missing read path.

const PREMADE_CARD_LIST_COLUMNS = [
	"id",
	"fields_data",
	"layout_type",
	"jlpt_level",
	"state",
	"is_suspended",
	"due",
	"lapses",
].join(", ");

/** Row shape returned by SELECT PREMADE_CARD_LIST_COLUMNS. */
const PremadeCardRowSchema = CardDbRowSchema.pick({
	id: true,
	fields_data: true,
	layout_type: true,
	jlpt_level: true,
	state: true,
	is_suspended: true,
	due: true,
	lapses: true,
});

type PremadeCardRow = z.infer<typeof PremadeCardRowSchema>;

/**
 * Maps a premade source card row to the wire-format `ApiCrossDeckCardListItem`
 * so the catalogue preview reuses the exact card-table the owned-deck preview
 * renders. `deckId`/`deckName` carry the premade deck's identity (premade cards
 * have no owning `decks` row), and the FSRS columns reflect the pristine source
 * state — the preview is read-only and hides them, but the contract requires
 * them present.
 */
function toPremadeCardListItem(
	raw: PremadeCardRow,
	premadeDeckId: string,
	premadeDeckName: string,
): ApiCrossDeckCardListItem {
	return {
		id: raw.id,
		deckId: premadeDeckId,
		deckName: premadeDeckName,
		fieldsData: raw.fields_data as FieldsData,
		layoutType: raw.layout_type,
		jlptLevel: raw.jlpt_level,
		state: raw.state,
		isSuspended: raw.is_suspended,
		due: raw.due,
		lapses: raw.lapses,
	};
}

export interface PremadeDeckCardsResult {
	items: ApiCrossDeckCardListItem[];
	hasMore: boolean;
	totalCount: number;
}

/**
 * Per-axis natural sort direction, mirroring the cross-deck RPC default and
 * the frontend `naturalSortDirFor`. Applied when the caller omits `sortDir`.
 */
function naturalSortDir(sort: ListPremadeDeckCardsQuery["sort"]): "asc" | "desc" {
	switch (sort) {
		case "due": return "asc";
		case "recent":
		case "lapses":
		default: return "desc";
	}
}

/**
 * Maps a sort axis to its `cards` column. `recent` orders by authored/seed
 * order (created_at); `due`/`lapses` by the FSRS columns.
 */
const SORT_COLUMN: Record<ListPremadeDeckCardsQuery["sort"], string> = {
	recent: "created_at",
	due: "due",
	lapses: "lapses",
};

/**
 * Returns a paginated, filtered, sorted slice of a premade deck's source cards
 * for the read-only catalogue preview. Throws 404 (via `getPremadeDeck`) when
 * the deck is missing or inactive.
 *
 * Filtering and sorting mirror the cross-deck browser so the preview reuses the
 * same `DeckCardToolbar` (status) and `CardsCountLine` (sort) chrome: `status`
 * filters on FSRS state, `sort`/`sortDir` cover recent/due/lapses, and `search`
 * is a case-insensitive substring match across word/reading/meaning. The search
 * term is sanitized before interpolation into the PostgREST `.or()` filter —
 * commas and parentheses are structural in that grammar, so they're stripped to
 * close the filter-injection vector a bound RPC parameter wouldn't have.
 *
 * Source cards share pristine FSRS state (state 0, due now, 0 lapses), so the
 * status filter and due/lapses sorts mostly resolve to "all new" — but the
 * contract matches the reused chrome exactly.
 */
export async function listPremadeDeckCards(
	premadeDeckId: string,
	params: ListPremadeDeckCardsQuery,
): Promise<PremadeDeckCardsResult> {
	// Validates existence + active flag (404 on miss) and supplies the deck name
	// the card-table column needs.
	const deck = await getPremadeDeck(premadeDeckId);

	const offset = params.offset ?? 0;
	const sortDir = params.sortDir ?? naturalSortDir(params.sort);
	const ascending = sortDir === "asc";

	let query = supabaseAdmin
		.from("cards")
		.select(PREMADE_CARD_LIST_COLUMNS, { count: "exact" })
		.eq("premade_deck_id", premadeDeckId);

	// Status filter — same state/is_suspended mapping as `list_cards_cross_deck`
	// (migration 20260630000003). `all`/undefined applies no filter.
	switch (params.status) {
		case "new":
			query = query.eq("state", 0).eq("is_suspended", false);
			break;
		case "learning":
			query = query.in("state", [1, 3]).eq("is_suspended", false);
			break;
		case "review":
			query = query.eq("state", 2).eq("is_suspended", false);
			break;
		case "suspended":
			query = query.eq("is_suspended", true);
			break;
		default:
			break;
	}

	// Direction-aware order on the chosen axis, with an `id` tiebreak (in the
	// same direction) so offset pagination is stable across pages even when the
	// primary sort key collides — which it always does for pristine due/lapses.
	query = query
		.order(SORT_COLUMN[params.sort], { ascending })
		.order("id", { ascending })
		.range(offset, offset + params.limit - 1);

	const search = params.search?.trim();
	if (search !== undefined && search.length > 0) {
		// Strip PostgREST filter-grammar metacharacters (`,` `(` `)` `*` `\`)
		// from user input before interpolation. `*` is PostgREST's ilike
		// wildcard; the others delimit/group conditions.
		const safe = search.replace(/[,()*\\]/g, " ").trim().toLowerCase();
		if (safe.length > 0) {
			const pattern = `*${safe}*`;
			query = query.or(
				[
					`fields_data->>word.ilike.${pattern}`,
					`fields_data->>reading.ilike.${pattern}`,
					`fields_data->>meaning.ilike.${pattern}`,
				].join(","),
			);
		}
	}

	const { data, error, count } = await query;
	if (error !== null) {
		throw dbError("list premade deck cards", error);
	}

	const rows = z.array(PremadeCardRowSchema).parse(data ?? []);
	const items = rows.map(row => toPremadeCardListItem(row, premadeDeckId, deck.name));
	const totalCount = count ?? 0;
	// Offset pagination: more pages remain when the window's far edge hasn't
	// reached the filtered total yet.
	const hasMore = offset + items.length < totalCount;

	return { items, hasMore, totalCount };
}

/**
 * Returns a single active premade deck by ID. Throws 404 if missing or inactive.
 */
export async function getPremadeDeck(id: string): Promise<ApiPremadeDeck> {
	const { data, error } = await supabaseAdmin
		.from("premade_decks")
		.select(PREMADE_COLUMNS)
		.eq("id", id)
		.eq("is_active", true)
		.single();

	if (error !== null || data === null) {
		throw new AppError(404, "Premade deck not found", { code: "PREMADE_DECK_NOT_FOUND" });
	}

	return toPremadeRow(PremadeDeckListRpcRowSchema.parse(data));
}

/**
 * Copies a premade deck into a new standalone deck owned by the user. Atomic
 * on the SQL side: either a new `decks` row plus every cloned card lands, or
 * nothing does. Backend Completion Plan Stage 4 (copy model) replaces the
 * earlier `subscribe_to_premade_deck` RPC.
 *
 * Duplicates are allowed by design: two consecutive calls for the same user
 * + premade deck produce two independent decks. The caller's idempotency key
 * (set at the controller layer via `withIdempotency`) is the only guard
 * against accidental double-clicks; deliberate duplicate copies remain
 * legitimate ("I want to restart fresh while keeping the old deck's
 * progress").
 *
 * Cards in the new deck start with fresh FSRS state (state=0, due=NOW,
 * reps=0, lapses=0). Embeddings are carried from the source row so
 * similarity search works on day 1 without a backfill.
 *
 * Throws 404 `PREMADE_DECK_NOT_FOUND` when the source is missing or
 * `is_active = FALSE`; any other RPC failure surfaces via `dbError()`.
 */
export async function copyPremadeDeck(
	userId: string,
	premadeDeckId: string,
): Promise<ApiCopyPremadeDeckResult> {
	const { data, error } = await supabaseAdmin.rpc("copy_premade_deck", asPayload({
		p_user_id: userId,
		p_premade_deck_id: premadeDeckId,
	}));

	if (error !== null) {
		// The new RPC raises `premade_deck_not_found` with SQLSTATE 02000
		// (no_data_found) when the source is inactive or missing. Translate
		// to HTTP 404 — same code the previous subscribe path used.
		if (error.code === "02000" && error.message.includes("premade_deck_not_found")) {
			throw new AppError(404, "Premade deck not found", { code: "PREMADE_DECK_NOT_FOUND" });
		}
		throw dbError("copy premade deck", error);
	}

	const rows = z.array(CopyRpcRowSchema).parse(data ?? []);
	const row = rows[0];
	if (row === undefined) {
		// RPC succeeded but returned no row — should never happen under the
		// new contract (the RPC always RETURN QUERYs one row). Surface as 500
		// so a future regression is loud.
		throw new AppError(500, "Copy RPC returned no row", { code: "PREMADE_COPY_RPC_EMPTY" });
	}

	log.info(
		{ userId, premadeDeckId, deckId: row.deck_id, cardCount: row.card_count },
		"copied premade deck",
	);

	// The copied cards start as New, so the cached due set is now stale.
	// Fire-and-forget, mirroring the FSRS write paths in fsrs.service.ts.
	void invalidateDueCache(userId);

	return {
		deckId: row.deck_id,
		cardCount: row.card_count,
	};
}
