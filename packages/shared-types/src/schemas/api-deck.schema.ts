// Deck + premade-deck wire-format schemas. Lifted out of api.schema.ts; re-exported.

import { z } from "zod";

import { deckTypeSchema, jlptLevelSchema } from "./api-core.schema.ts";

// ─── Decks ────────────────────────────────────────────────────────────────────

export const ApiDeckSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	deckType: deckTypeSchema,
	cardCount: z.number(),
	// `sourcePremadeId` is attribution only — non-null means "this deck was
	// started from a premade catalogue entry". Backend Completion Plan
	// Stage 4 (copy model) dropped the companion `is_premade_fork` boolean:
	// under the new model all decks are owned, standalone, and delete via
	// the same path regardless of origin.
	sourcePremadeId: z.string().nullable(),
	version: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
	/**
	 * ISO 8601 timestamp the user archived the deck, or `null` when the deck
	 * is active. Archived decks are excluded from the default `GET /decks`
	 * listing, the `/reviews/due` queue, the review forecast, and every
	 * write path except `DELETE /decks/:id` and `POST /decks/:id/unarchive`.
	 */
	archivedAt: z.string().nullable(),
});

export const ApiDeckWithStatsSchema = ApiDeckSchema.extend({
	/** Cards currently due (interval expired) and not suspended. */
	dueCount: z.number(),
	/** Cards in state=New (never reviewed). Snapshot of the entire deck, not "new today". */
	newCount: z.number(),
	/** Cards that have reached graduated maturity: state=Review AND scheduled_days >= 21 (Anki convention). */
	matureCount: z.number(),
	/** Subset of dueCount: due cards in state=New. */
	dueNewCount: z.number(),
	/** Subset of dueCount: due cards in state != New (Review / Learning / Relearning). */
	dueReviewCount: z.number(),
	/**
	 * Timestamp (ISO 8601) of the most recent review across any card in the
	 * deck — `MAX(cards.last_review)` server-side. `null` when no card in the
	 * deck has been reviewed yet (semantically distinct from a 0 count). Added
	 * by the `list_decks_paginated` rollup migration (Backend Completion Plan
	 * Stage 3) and surfaced on both GET /decks and GET /decks/:id.
	 */
	lastReviewedAt: z.string().nullable(),
});

// ─── Premade decks ────────────────────────────────────────────────────────────

export const ApiPremadeDeckSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	deckType: deckTypeSchema,
	jlptLevel: jlptLevelSchema.nullable(),
	domain: z.string().nullable(),
	cardCount: z.number(),
	// `version` removed in Backend Completion Plan Stage 4 (copy model) —
	// there is no version drift to track once a user has copied; refreshing
	// content means deleting the deck and copying again.
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

/**
 * Result of `POST /api/v1/premade-decks/:id/copy` — Backend Completion Plan
 * Stage 4 (copy model). The user-facing response carries only the
 * newly-created deck id and the count of cards cloned into it; everything
 * else lives on the deck itself and is reachable via `GET /api/v1/decks/:id`.
 *
 * Replaces the prior `ApiSubscribeResult` shape: the subscription junction
 * (and therefore `subscriptionId` / `alreadyExisted`) no longer exists.
 * Duplicates are intentional under the copy model — two consecutive copies
 * of the same premade deck produce two independent `deckId` values.
 */
export const ApiCopyPremadeDeckResultSchema = z.object({
	deckId: z.string(),
	cardCount: z.number(),
});

/**
 * Result of `POST /api/v1/decks/:id/copy` — duplicates a user-owned deck
 * into a new standalone deck. Same wire shape as the premade copy result;
 * we keep them as separate types because the two routes have different
 * semantics (this one rejects premade source rows, doesn't carry
 * `source_premade_id`, and resolves a server-side default name).
 *
 * Duplicates are intentional under the copy model: repeated calls produce
 * independent decks. The controller's idempotency-key guards against
 * accidental double-clicks; deliberate duplicates use distinct keys.
 */
export const ApiCopyDeckResultSchema = z.object({
	deckId: z.string(),
	cardCount: z.number(),
});
