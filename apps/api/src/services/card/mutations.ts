import type { ApiCard } from "@fsrs-japanese/shared-types";

import { z } from "zod";
import { supabaseAdmin } from "../../db/supabase.ts";
import { asPayload } from "../../lib/db.ts";
import { invalidateDueCache } from "../../lib/due-cache.ts";
import { AppError, dbError } from "../../middleware/errorHandler.ts";

import { getCard } from "./crud.ts";

// ─── Move / copy / suspend / unsuspend ───────────────────────────────────────

/** Maps the RPC's SQLSTATE-tagged exception to a 404 AppError. */
function rpcCardNotFoundError(message?: string): never {
	throw new AppError(404, message ?? "Card not found", { code: "CARD_NOT_FOUND" });
}

/** Maps the RPC's `deck_not_found` exception to a 404 AppError. */
function rpcDeckNotFoundError(): never {
	throw new AppError(404, "Deck not found", { code: "DECK_NOT_FOUND" });
}

/** Reusable adapter: NO_DATA_FOUND (02000) → 404 with a stable code. */
function mapNotFoundError(err: { code?: string; message?: string } | null): void {
	if (err === null)
		return;
	if (err.code === "02000" && (err.message ?? "").includes("card_not_found")) {
		rpcCardNotFoundError();
	}
	if (err.code === "02000" && (err.message ?? "").includes("deck_not_found")) {
		rpcDeckNotFoundError();
	}
}

export async function moveCard(
	cardId: string,
	userId: string,
	targetDeckId: string,
): Promise<ApiCard> {
	const { error } = await supabaseAdmin.rpc("move_card", asPayload({
		p_card_id: cardId,
		p_user_id: userId,
		p_target_deck_id: targetDeckId,
	}));

	if (error !== null) {
		mapNotFoundError(error);
		throw dbError("move card", error);
	}

	return getCard(cardId, userId);
}

export async function copyCard(
	cardId: string,
	userId: string,
	targetDeckId: string,
): Promise<ApiCard> {
	const { data, error } = await supabaseAdmin.rpc("copy_card", asPayload({
		p_card_id: cardId,
		p_user_id: userId,
		p_target_deck_id: targetDeckId,
	}));

	if (error !== null) {
		mapNotFoundError(error);
		throw dbError("copy card", error);
	}

	const newId = z.string().uuid().parse(data);
	// The clone resets to New FSRS state, so the cached due set is now stale.
	void invalidateDueCache(userId);
	return getCard(newId, userId);
}

export async function suspendCard(
	cardId: string,
	userId: string,
): Promise<ApiCard> {
	const { error } = await supabaseAdmin.rpc("suspend_card", asPayload({
		p_card_id: cardId,
		p_user_id: userId,
	}));

	if (error !== null) {
		mapNotFoundError(error);
		throw dbError("suspend card", error);
	}

	return getCard(cardId, userId);
}

export async function unsuspendCard(
	cardId: string,
	userId: string,
): Promise<ApiCard> {
	const { error } = await supabaseAdmin.rpc("unsuspend_card", asPayload({
		p_card_id: cardId,
		p_user_id: userId,
	}));

	if (error !== null) {
		mapNotFoundError(error);
		throw dbError("unsuspend card", error);
	}

	return getCard(cardId, userId);
}
