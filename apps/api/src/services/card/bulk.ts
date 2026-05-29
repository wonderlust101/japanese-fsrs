import type { ApiBulkCardMutationResult } from "@fsrs-japanese/shared-types";

import { z } from "zod";
import { supabaseAdmin } from "../../db/supabase.ts";
import { asPayload } from "../../lib/db.ts";
import { dbError } from "../../middleware/errorHandler.ts";

const BulkResultRpcSchema = z.object({
	succeeded: z.array(z.string()),
	failed: z.array(z.object({
		id: z.string(),
		error: z.string(),
		code: z.string().optional(),
	})),
});

function parseBulkResult(data: unknown): ApiBulkCardMutationResult {
	return BulkResultRpcSchema.parse(data ?? { succeeded: [], failed: [] });
}

export async function bulkMoveCards(
	cardIds: string[],
	userId: string,
	targetDeckId: string,
): Promise<ApiBulkCardMutationResult> {
	const { data, error } = await supabaseAdmin.rpc("bulk_move_cards", asPayload({
		p_card_ids: cardIds,
		p_user_id: userId,
		p_target_deck_id: targetDeckId,
	}));

	if (error !== null) {
		throw dbError("bulk move cards", error);
	}
	return parseBulkResult(data);
}

export async function bulkSuspendCards(
	cardIds: string[],
	userId: string,
): Promise<ApiBulkCardMutationResult> {
	const { data, error } = await supabaseAdmin.rpc("bulk_suspend_cards", asPayload({
		p_card_ids: cardIds,
		p_user_id: userId,
	}));
	if (error !== null)
		throw dbError("bulk suspend cards", error);
	return parseBulkResult(data);
}

export async function bulkUnsuspendCards(
	cardIds: string[],
	userId: string,
): Promise<ApiBulkCardMutationResult> {
	const { data, error } = await supabaseAdmin.rpc("bulk_unsuspend_cards", asPayload({
		p_card_ids: cardIds,
		p_user_id: userId,
	}));
	if (error !== null)
		throw dbError("bulk unsuspend cards", error);
	return parseBulkResult(data);
}

export async function bulkDeleteCards(
	cardIds: string[],
	userId: string,
): Promise<ApiBulkCardMutationResult> {
	const { data, error } = await supabaseAdmin.rpc("bulk_delete_cards", asPayload({
		p_card_ids: cardIds,
		p_user_id: userId,
	}));
	if (error !== null)
		throw dbError("bulk delete cards", error);
	return parseBulkResult(data);
}
