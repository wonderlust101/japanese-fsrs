import { cardSortDirEnum, cardSortFieldEnum, cardStatusFilterEnum, deckTypeEnum, jlptLevelEnum } from "@fsrs-japanese/shared-types";

import { z } from "zod";

export const listPremadeDecksQuerySchema = z.object({
	deckType: deckTypeEnum.optional(),
	jlptLevel: jlptLevelEnum.optional(),
	domain: z.string().trim().min(1).max(50).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	// Opaque cursor — see apps/api/src/lib/http.ts:encodeCursor.
	cursor: z.string().min(1).max(512).optional(),
}).strict();

export const premadeDeckIdParamSchema = z.object({
	id: z.string().uuid("Invalid premade deck ID"),
});

// Read-only catalogue preview of a premade deck's source cards. Offset
// pagination (the source list is small and curated, so a cursor wouldn't earn
// its complexity) plus a free-text search mirroring the cross-deck browser.
export const listPremadeDeckCardsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
	search: z.string().trim().min(1).max(100).optional(),
	// Aligned with the cross-deck browser so the preview reuses the same filter
	// (DeckCardToolbar) and sort (CardsCountLine) components. `status` filters by
	// FSRS state; `sort`/`sortDir` mirror the recent/due/lapses axes. `sortDir`
	// is optional — omit to apply the per-axis natural default (recent DESC, due
	// ASC, lapses DESC). Source cards are pristine, so these mostly resolve to
	// "all new", but the contract matches the reused chrome.
	status: cardStatusFilterEnum.optional(),
	sort: cardSortFieldEnum.default("recent"),
	sortDir: cardSortDirEnum.optional(),
}).strict();

export type ListPremadeDecksQuery = z.infer<typeof listPremadeDecksQuerySchema>;
export type ListPremadeDeckCardsQuery = z.infer<typeof listPremadeDeckCardsQuerySchema>;
