import type { ApiDeck } from "@fsrs-japanese/shared-types";

import { supabaseAdmin } from "../../db/supabase.ts";
import { AppError, dbError } from "../../middleware/errorHandler.ts";

import { DECK_COLUMNS, DeckListRpcRowSchema, log, toRow } from "./shared.ts";

/**
 * Sets `decks.archived_at = NOW()` so the deck disappears from the active
 * listing, the review queue, and every write path that flows through
 * `assertDeckActive`. Idempotent: archiving an already-archived deck leaves
 * the original timestamp in place and returns the row unchanged.
 *
 * Returns the refreshed deck row (without rollup stats) so the controller
 * can echo the freshly-archived shape and clients can update their cache.
 *
 * Errors:
 *   - 404 `DECK_NOT_FOUND` — deck is missing or owned by another user.
 *
 * Note: no version-check / `If-Match` here. Archive is a one-click action,
 * not a content edit; coordinating an optimistic-concurrency header would
 * be ceremony without benefit. The `version` column still bumps inside the
 * UPDATE so any caller holding a stale snapshot will see a new version on
 * the next PATCH.
 */
export async function archiveDeck(deckId: string, userId: string): Promise<ApiDeck> {
	// Existence + ownership probe first so we can distinguish 404 from a
	// generic DB failure. `.maybeSingle()` returns `{ data: null }` (not an
	// error) when the row is missing.
	const { data: existing, error: probeError } = await supabaseAdmin
		.from("decks")
		.select("archived_at")
		.eq("id", deckId)
		.eq("user_id", userId)
		.maybeSingle();

	if (probeError !== null) {
		throw dbError("archive deck (probe)", probeError);
	}
	if (existing === null) {
		throw new AppError(404, "Deck not found", { code: "DECK_NOT_FOUND" });
	}

	// Idempotent: if already archived, just re-read and return the row. We
	// deliberately don't refresh the `archived_at` timestamp — preserving the
	// original moment-of-archive is more useful for UI ("archived 3 days ago")
	// than a sliding timestamp would be.
	if (existing.archived_at !== null) {
		const { data, error } = await supabaseAdmin
			.from("decks")
			.select(DECK_COLUMNS)
			.eq("id", deckId)
			.eq("user_id", userId)
			.single();
		if (error !== null || data === null) {
			throw dbError("archive deck (re-read)", error);
		}
		return toRow(DeckListRpcRowSchema.parse(data));
	}

	// Archive is a state-transition, not a content edit. We leave `version`
	// alone — that column tracks content edits for the PATCH/If-Match flow,
	// which is already blocked on archived decks by `assertDeckActive`. The
	// `archived_at` change is itself the audit signal.
	const { data, error } = await supabaseAdmin
		.from("decks")
		.update({ archived_at: new Date().toISOString() })
		.eq("id", deckId)
		.eq("user_id", userId)
		.select(DECK_COLUMNS)
		.single();

	if (error !== null || data === null) {
		throw dbError("archive deck", error);
	}

	const row = toRow(DeckListRpcRowSchema.parse(data));
	log.info({ userId, deckId }, "archived deck");
	return row;
}

/**
 * Clears `decks.archived_at`, restoring the deck to the active listing and
 * the review queue. Idempotent: unarchiving an already-active deck is a
 * no-op (returns the row unchanged). The `archived_at` value is *cleared*,
 * not retained — once a deck is restored we treat the previous archive as
 * over, and a subsequent archive will get a fresh timestamp.
 *
 * Errors:
 *   - 404 `DECK_NOT_FOUND` — deck is missing or owned by another user.
 */
export async function unarchiveDeck(deckId: string, userId: string): Promise<ApiDeck> {
	const { data: existing, error: probeError } = await supabaseAdmin
		.from("decks")
		.select("archived_at")
		.eq("id", deckId)
		.eq("user_id", userId)
		.maybeSingle();

	if (probeError !== null) {
		throw dbError("unarchive deck (probe)", probeError);
	}
	if (existing === null) {
		throw new AppError(404, "Deck not found", { code: "DECK_NOT_FOUND" });
	}
	if (existing.archived_at === null) {
		const { data, error } = await supabaseAdmin
			.from("decks")
			.select(DECK_COLUMNS)
			.eq("id", deckId)
			.eq("user_id", userId)
			.single();
		if (error !== null || data === null) {
			throw dbError("unarchive deck (re-read)", error);
		}
		return toRow(DeckListRpcRowSchema.parse(data));
	}

	const { data, error } = await supabaseAdmin
		.from("decks")
		.update({ archived_at: null })
		.eq("id", deckId)
		.eq("user_id", userId)
		.select(DECK_COLUMNS)
		.single();

	if (error !== null || data === null) {
		throw dbError("unarchive deck", error);
	}

	const row = toRow(DeckListRpcRowSchema.parse(data));
	log.info({ userId, deckId }, "unarchived deck");
	return row;
}
