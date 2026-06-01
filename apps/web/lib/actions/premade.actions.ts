"use server";

import type { ApiCopyPremadeDeckResult, ApiList, ApiPremadeDeck, CardSortDir, CardSortField, CardStatusFilter } from "@fsrs-japanese/shared-types";
import {
	ApiCopyPremadeDeckResultSchema,
	ApiCrossDeckCardListItemSchema,
	apiListEnvelope,
	ApiPremadeDeckSchema,

} from "@fsrs-japanese/shared-types";
import { z } from "zod";
import { apiCall, apiCallSafe } from "@/lib/api/client";

const EMPTY_PREMADE_PAGE: ApiList<ApiPremadeDeck> = { items: [], nextCursor: null, hasMore: false };

/**
 * Read-only catalogue preview of a premade deck's source cards. Mirrors the
 * cross-deck list result shape so the preview surface reuses the same card
 * table the owned-deck preview renders.
 */
const PremadeDeckCardsResultSchema = z.object({
	items: z.array(ApiCrossDeckCardListItemSchema),
	hasMore: z.boolean(),
	totalCount: z.number().int().nonnegative(),
});

export type PremadeDeckCardsResult = z.infer<typeof PremadeDeckCardsResultSchema>;

const EMPTY_PREMADE_CARDS: PremadeDeckCardsResult = { items: [], hasMore: false, totalCount: 0 };

export async function listPremadeDecksAction(
	options: { limit?: number; cursor?: string } = {},
): Promise<ApiList<ApiPremadeDeck>> {
	const params = new URLSearchParams();
	params.set("limit", String(options.limit ?? 50));
	if (options.cursor !== undefined)
		params.set("cursor", options.cursor);

	return apiCallSafe<ApiList<ApiPremadeDeck>>(
		`/api/v1/premade-decks?${params.toString()}`,
		apiListEnvelope(ApiPremadeDeckSchema),
		{},
		EMPTY_PREMADE_PAGE,
	);
}

/**
 * Fetches a single active premade deck for the catalogue preview page. Returns
 * `null` on 404/error so the route can call `notFound()` — mirrors
 * `getDeckAction`'s nullable contract.
 */
export async function getPremadeDeckAction(
	premadeDeckId: string,
): Promise<ApiPremadeDeck | null> {
	return apiCallSafe<ApiPremadeDeck | null>(
		`/api/v1/premade-decks/${premadeDeckId}`,
		ApiPremadeDeckSchema.nullable(),
		{},
		null,
	);
}

/**
 * Lists a premade deck's source cards (paginated, optionally searched) for the
 * read-only preview. Non-critical read — returns an empty page rather than
 * surfacing an error, matching `listCardsCrossDeckAction`.
 */
export async function listPremadeDeckCardsAction(
	premadeDeckId: string,
	options: {
		limit?: number;
		offset?: number;
		search?: string;
		status?: CardStatusFilter;
		sort?: CardSortField;
		sortDir?: CardSortDir | null;
	} = {},
): Promise<PremadeDeckCardsResult> {
	const params = new URLSearchParams();
	params.set("limit", String(options.limit ?? 25));
	if (options.offset !== undefined && options.offset > 0)
		params.set("offset", String(options.offset));
	if (options.search !== undefined && options.search.length > 0)
		params.set("search", options.search);
	if (options.status !== undefined && options.status !== "all")
		params.set("status", options.status);
	if (options.sort !== undefined)
		params.set("sort", options.sort);
	if (options.sortDir !== undefined && options.sortDir !== null)
		params.set("sortDir", options.sortDir);

	return apiCallSafe<PremadeDeckCardsResult>(
		`/api/v1/premade-decks/${premadeDeckId}/cards?${params.toString()}`,
		PremadeDeckCardsResultSchema,
		{},
		EMPTY_PREMADE_CARDS,
	);
}

/**
 * Backend Completion Plan Stage 4 (copy model). Replaces the prior
 * `subscribeToPremadeDeckAction` and `unsubscribeFromPremadeDeckAction`
 * actions and the `listMySubscriptionsAction` reader.
 *
 * Duplicates are allowed by design — a fresh `Idempotency-Key` per click
 * is generated here so a deliberate "copy again" produces a new deck. To
 * coalesce double-clicks, callers should debounce the mutation at the UI
 * layer rather than reusing keys.
 */
export async function copyPremadeDeckAction(
	premadeDeckId: string,
): Promise<ApiCopyPremadeDeckResult> {
	const key = crypto.randomUUID();
	return apiCall<ApiCopyPremadeDeckResult>(
		`/api/v1/premade-decks/${premadeDeckId}/copy`,
		ApiCopyPremadeDeckResultSchema,
		{
			method: "POST",
			headers: { "Idempotency-Key": key },
		},
		"Failed to copy premade deck",
	);
}
