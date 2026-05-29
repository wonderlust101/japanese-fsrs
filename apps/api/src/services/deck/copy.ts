import type { ApiCopyDeckResult } from "@fsrs-japanese/shared-types";

import { z } from "zod";
import { supabaseAdmin } from "../../db/supabase.ts";
import { asPayload } from "../../lib/db.ts";
import { invalidateDueCache } from "../../lib/due-cache.ts";
import { AppError, dbError } from "../../middleware/errorHandler.ts";

import { CopyDeckRpcRowSchema, log } from "./shared.ts";

/**
 * Duplicates a user-owned deck into a new standalone deck. Backed by the
 * `copy_user_deck` RPC (migration 20260621000000). Atomic on the SQL side:
 * either the new `decks` row plus every cloned card lands, or nothing does.
 *
 * Behavior contract (mirrors the migration header):
 *   - Cloned cards start with fresh FSRS state (state=0, due=NOW, reps=0,
 *     lapses=0). Source review history stays with the original deck.
 *   - Tags and `is_suspended` are NOT carried; suspended source cards are
 *     skipped entirely.
 *   - Embeddings are carried so similarity search works without a backfill.
 *   - Caller-supplied `name` (trimmed) wins. When omitted, the RPC resolves
 *     `<source> (Copy)`, `<source> (Copy 2)`, … until the name is unique
 *     within the caller's decks.
 *
 * Premade source decks (`user_id IS NULL`) and cross-user attempts both
 * fail closed with 404 `DECK_NOT_FOUND` — the RPC's ownership check does
 * not distinguish "missing" from "not yours" so we don't leak ownership
 * signals. Premade copying still goes through `copyPremadeDeck`.
 *
 * Idempotency: callers pass `Idempotency-Key` at the controller layer via
 * `withIdempotency`. Same key + same payload → replay the original 201
 * response without re-cloning. Deliberate duplicate copies (e.g. "I want a
 * second fresh start") use distinct keys and produce independent decks —
 * that's intentional under the copy model.
 */
export async function copyDeck(
	userId: string,
	sourceDeckId: string,
	name?: string,
): Promise<ApiCopyDeckResult> {
	const { data, error } = await supabaseAdmin.rpc("copy_user_deck", asPayload({
		p_user_id: userId,
		p_source_deck_id: sourceDeckId,
		p_target_name: name ?? null,
	}));

	if (error !== null) {
		// RPC raises `deck_not_found` with SQLSTATE 02000 (no_data_found) when
		// the source is missing, owned by another user, or a premade source
		// row (user_id IS NULL). Translate to HTTP 404 — same code/shape the
		// get/update/delete paths use.
		if (error.code === "02000" && error.message.includes("deck_not_found")) {
			throw new AppError(404, "Deck not found", { code: "DECK_NOT_FOUND" });
		}
		throw dbError("copy deck", error);
	}

	const rows = z.array(CopyDeckRpcRowSchema).parse(data ?? []);
	const row = rows[0];
	if (row === undefined) {
		// RPC succeeded but returned no row — should never happen under the
		// contract (the RPC always RETURN QUERYs one row). Surface as 500 so
		// a future regression is loud rather than silently returning empty.
		throw new AppError(500, "Copy RPC returned no row", { code: "DECK_COPY_RPC_EMPTY" });
	}

	log.info(
		{ userId, sourceDeckId, deckId: row.deck_id, cardCount: row.card_count },
		"copied user deck",
	);

	// Cloned cards reset to New FSRS state, so the cached due set is now stale.
	// Fire-and-forget, mirroring the FSRS write paths in fsrs.service.ts.
	void invalidateDueCache(userId);

	return {
		deckId: row.deck_id,
		cardCount: row.card_count,
	};
}
