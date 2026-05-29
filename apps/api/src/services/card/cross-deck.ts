import type { ApiCrossDeckCardListItem, CardMissingField, CardPresentField, CardSortDir, CardSortField, CardStatusFilter, CrossDeckJlptFilter, FieldsData, PitchPattern } from "@fsrs-japanese/shared-types";

import { z } from "zod";
import { supabaseAdmin } from "../../db/supabase.ts";
import { asPayload } from "../../lib/db.ts";
import { dbError } from "../../middleware/errorHandler.ts";

import { CardDbRowSchema } from "./shared.ts";

// ─── Cross-deck list ─────────────────────────────────────────────────────────
//
// Powers GET /api/v1/cards/cross-deck (the /cards browser). Two RPCs are
// fired in parallel: `list_cards_cross_deck` for the page slice and
// `count_cards_cross_deck` for the total-count footer.

/** Row shape returned by `list_cards_cross_deck`. */
const CrossDeckCardRpcRowSchema = CardDbRowSchema.pick({
	id: true,
	fields_data: true,
	layout_type: true,
	jlpt_level: true,
	state: true,
	is_suspended: true,
	due: true,
	lapses: true,
	created_at: true,
}).extend({
	deck_id: z.string(),
	deck_name: z.string(),
});

type CrossDeckCardRpcRow = z.infer<typeof CrossDeckCardRpcRowSchema>;

function toApiCrossDeckCardListItem(raw: CrossDeckCardRpcRow): ApiCrossDeckCardListItem {
	return {
		id: raw.id,
		deckId: raw.deck_id,
		deckName: raw.deck_name,
		fieldsData: raw.fields_data as FieldsData,
		layoutType: raw.layout_type,
		jlptLevel: raw.jlpt_level,
		state: raw.state,
		isSuspended: raw.is_suspended,
		due: raw.due,
		lapses: raw.lapses,
	};
}

export interface CrossDeckCardListResult {
	items: ApiCrossDeckCardListItem[];
	hasMore: boolean;
	totalCount: number;
}

export interface CrossDeckListParams {
	limit: number;
	offset?: number;
	search?: string;
	deckId?: string;
	jlptLevel?: CrossDeckJlptFilter;
	status?: CardStatusFilter;
	missingField?: CardMissingField;
	presentField?: CardPresentField;
	pitchPattern?: PitchPattern;
	sort?: CardSortField;
	sortDir?: CardSortDir;
}

export async function listCardsCrossDeck(
	userId: string,
	params: CrossDeckListParams,
): Promise<CrossDeckCardListResult> {
	const sort = params.sort ?? "recent";
	const offset = params.offset ?? 0;

	const [listResult, countResult] = await Promise.all([
		supabaseAdmin.rpc("list_cards_cross_deck", asPayload({
			p_user_id: userId,
			p_limit: params.limit,
			p_offset: offset,
			p_deck_id: params.deckId ?? null,
			p_status: params.status ?? null,
			p_jlpt_level: params.jlptLevel ?? null,
			p_search: params.search ?? null,
			p_missing_field: params.missingField ?? null,
			p_sort: sort,
			p_present_field: params.presentField ?? null,
			p_pitch_pattern: params.pitchPattern ?? null,
			// null means "use the RPC's per-axis natural default" — see
			// migration 20260630000001 for the resolution logic.
			p_sort_dir: params.sortDir ?? null,
		})),
		supabaseAdmin.rpc("count_cards_cross_deck", asPayload({
			p_user_id: userId,
			p_deck_id: params.deckId ?? null,
			p_status: params.status ?? null,
			p_jlpt_level: params.jlptLevel ?? null,
			p_search: params.search ?? null,
			p_missing_field: params.missingField ?? null,
			p_present_field: params.presentField ?? null,
			p_pitch_pattern: params.pitchPattern ?? null,
		})),
	]);

	if (listResult.error !== null) {
		throw dbError("list cards cross-deck", listResult.error);
	}
	if (countResult.error !== null) {
		throw dbError("count cards cross-deck", countResult.error);
	}

	const rows = z.array(CrossDeckCardRpcRowSchema).parse(listResult.data ?? []);
	const items = rows.map(toApiCrossDeckCardListItem);
	const totalCount = z.number().int().nonnegative().parse(countResult.data ?? 0);
	// With offset pagination, hasMore is derived from totalCount rather
	// than from a +1 limit-bump probe. Cheaper at the RPC and removes the
	// tail-row slicing the cursor version needed.
	const hasMore = offset + items.length < totalCount;

	return {
		items,
		hasMore,
		totalCount,
	};
}
