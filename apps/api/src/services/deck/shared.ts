import type { ApiDeck, ApiDeckWithStats } from "@fsrs-japanese/shared-types";
import { deckTypeEnum } from "@fsrs-japanese/shared-types";

import { z } from "zod";
import { componentLogger } from "../../lib/logger.ts";
import { uuidIdCursorSchema } from "../../schemas/common.schema.ts";

export const log = componentLogger("deck.service");

// ─── Column projections ───────────────────────────────────────────────────────
// Keep these in sync with the return interfaces below. Never use select('*').

export const DECK_COLUMNS = [
	"id",
	"name",
	"description",
	"deck_type",
	// `is_premade_fork` was dropped in Backend Completion Plan Stage 4 (copy
	// model). `source_premade_id` stays as attribution-only — non-null means
	// "this deck started from a premade catalogue entry"; nothing branches on
	// it anymore.
	"source_premade_id",
	"card_count",
	"version",
	"created_at",
	"updated_at",
	// Archive timestamp (migration 20260622000000). NULL = active, non-null
	// = archived. Surfaced on the wire as `archivedAt`.
	"archived_at",
].join(", ");

// ─── RPC envelope schema ──────────────────────────────────────────────────────
// Mirrors the analytics.service.ts / review.service.ts precedent: parse the
// RPC result so any future column drift surfaces as a clean ZodError. Shared
// with direct .from('decks').select(...) reads — rollup columns added in
// Backend Completion Plan Stage 3 are `.optional()` here so the schema can
// validate both shapes (RPC carries them; direct table reads do not).
export const DeckListRpcRowSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	deck_type: deckTypeEnum,
	// `is_premade_fork` removed in Backend Completion Plan Stage 4 (copy
	// model). The column no longer exists on the decks table.
	source_premade_id: z.string().nullable(),
	card_count: z.number(),
	version: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
	// Archive timestamp (migration 20260622000000). NULL = active, non-null
	// = archived. Present on both RPC rows and direct .from('decks') reads.
	archived_at: z.string().nullable(),
	// Stage 3 — present on list_decks_paginated rows, absent on direct
	// `.from('decks').select(DECK_COLUMNS)` reads. Kept optional rather
	// than splitting into a second schema so the existing shared usage in
	// createDeck / updateDeck continues to parse cleanly.
	due_count: z.number().optional(),
	new_count: z.number().optional(),
	mature_count: z.number().optional(),
	due_new_count: z.number().optional(),
	due_review_count: z.number().optional(),
	last_reviewed_at: z.string().nullable().optional(),
});

/**
 * Raw snake_case deck row. Inferred from DeckListRpcRowSchema (the schema
 *  is shared between the list_decks_paginated RPC and direct .from('decks')
 *  reads, since the column projections match).
 */
export type DeckDbRow = z.infer<typeof DeckListRpcRowSchema>;

/**
 * Slim projection used by deleteDeck for the existence check. After the
 *  Backend Completion Plan Stage 4 (copy model) refactor, all decks delete
 *  through the same path — no branch on `is_premade_fork`, so we only need
 *  the `id` to confirm the row exists and is owned by the caller.
 */
export const DeckOwnerRowSchema = z.object({
	id: z.string(),
});

/**
 * Envelope for the `copy_user_deck` RPC (migration 20260621000000). Mirrors
 *  the `copy_premade_deck` envelope in premade.service.ts. The RPC always
 *  RETURN QUERYs one row carrying the new deck id + the count of cards
 *  cloned into it; a zero-row return indicates a regression.
 */
export const CopyDeckRpcRowSchema = z.object({
	deck_id: z.string(),
	card_count: z.number(),
});

/**
 * Cursor payload for the decks-list endpoint. The `list_decks_paginated`
 *  RPC re-derives the sort timestamp from the row pointed to by `id`, so the
 *  cursor only needs to carry `id` today. Shared with card.service.ts and
 *  premade.service.ts via `uuidIdCursorSchema` — see schemas/common.schema.ts.
 */
export const deckListCursorSchema = uuidIdCursorSchema;

/** Maps a raw DB row (snake_case) to the camelCase API shape. */
export function toRow(raw: DeckDbRow): ApiDeck {
	return {
		id: raw.id,
		name: raw.name,
		description: raw.description,
		deckType: raw.deck_type,
		sourcePremadeId: raw.source_premade_id,
		cardCount: raw.card_count,
		version: raw.version,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		archivedAt: raw.archived_at,
	};
}

/**
 * Maps a raw RPC row carrying rollup columns to the ApiDeckWithStats wire
 * shape. Used by listDecks (Backend Completion Plan Stage 3 — collapses the
 * per-deck `getDeck` fanout into one round-trip).
 *
 * If the rollup fields are missing (e.g. the caller piped a non-RPC row in
 * by mistake), counts fall back to 0 and last_reviewed_at to null — the
 * service-layer Zod validation already rejected drift before reaching here,
 * so the COALESCE is a safety net rather than a silent data path.
 */
export function toRowWithStats(raw: DeckDbRow): ApiDeckWithStats {
	return {
		...toRow(raw),
		dueCount: raw.due_count ?? 0,
		newCount: raw.new_count ?? 0,
		matureCount: raw.mature_count ?? 0,
		dueNewCount: raw.due_new_count ?? 0,
		dueReviewCount: raw.due_review_count ?? 0,
		lastReviewedAt: raw.last_reviewed_at ?? null,
	};
}
