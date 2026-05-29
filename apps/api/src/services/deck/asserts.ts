import { supabaseAdmin } from "../../db/supabase.ts";
import { AppError, dbError } from "../../middleware/errorHandler.ts";

/**
 * Service-level guard used by every write path that mutates content inside
 * a deck (deck PATCH/copy, card create/update/forget/reschedule/move/copy/
 * suspend/unsuspend/regenerate-embedding, and the review-submit batch).
 * Throws 404 `DECK_NOT_FOUND` when the deck is missing or owned by another
 * user, and 422 `DECK_ARCHIVED` when it exists but `archived_at IS NOT NULL`.
 *
 * The 404 / 422 split matters: a missing deck is a routing bug; an archived
 * deck is a legitimate state the client should surface as "this deck is
 * frozen — unarchive to make changes." The two codes let the frontend
 * branch cleanly without parsing error strings.
 *
 * Reads only — no FOR UPDATE. The archive bit can race with this read in
 * theory, but the worst case is a write landing on the same statement an
 * archive request is committing; the row-level UPDATE that follows would
 * still succeed under MVCC. Heavier locks are not justified here — archive
 * is rare and the cost of a missed gate is one extra review, not data
 * corruption.
 */
export async function assertDeckActive(deckId: string, userId: string): Promise<void> {
	const { data, error } = await supabaseAdmin
		.from("decks")
		.select("archived_at")
		.eq("id", deckId)
		.eq("user_id", userId)
		.maybeSingle();

	if (error !== null) {
		throw dbError("assert deck active", error);
	}
	if (data === null) {
		throw new AppError(404, "Deck not found", { code: "DECK_NOT_FOUND" });
	}
	if (data.archived_at !== null) {
		throw new AppError(422, "Deck is archived. Unarchive it to make changes.", { code: "DECK_ARCHIVED" });
	}
}

/**
 * Per-card variant of `assertDeckActive`. Resolves the card's owning deck
 * via the `cards` table (ownership-gated on `user_id`) and forwards to
 * `assertDeckActive`. Used by every card-scoped write path so an archived
 * deck freezes its cards without each controller re-implementing the
 * card→deck lookup.
 *
 * Throws:
 *   - 404 `CARD_NOT_FOUND` — card is missing, owned by another user, or
 *     a premade source (`user_id` NULL). Matches `card.service.ts`'s 404
 *     shape so the frontend doesn't need to branch on the not-found code.
 *   - 404 `DECK_NOT_FOUND` — card row points at a deck that vanished
 *     (defensive: FK cascade should make this unreachable).
 *   - 422 `DECK_ARCHIVED` — the card's deck is archived.
 *
 * One round-trip for the card lookup, one for `assertDeckActive`. The
 * card-row read is a single-index probe; cost is comparable to the
 * existing `cards` fetch most card services already perform, so this
 * helper sits in front of those services without measurably changing
 * latency.
 */
export async function assertCardDeckActive(cardId: string, userId: string): Promise<void> {
	const { data, error } = await supabaseAdmin
		.from("cards")
		.select("deck_id")
		.eq("id", cardId)
		.eq("user_id", userId)
		.maybeSingle();

	if (error !== null) {
		throw dbError("assert card deck active (probe)", error);
	}
	if (data === null || data.deck_id === null) {
		throw new AppError(404, "Card not found", { code: "CARD_NOT_FOUND" });
	}
	await assertDeckActive(data.deck_id, userId);
}
