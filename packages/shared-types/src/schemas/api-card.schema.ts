// Card wire-format schemas (card / due / list-item / cross-deck / bulk-result /
// similar). Lifted out of api.schema.ts; re-exported from there.

import { z } from "zod";

import { jlptLevelSchema, layoutTypeSchema, stateSchema } from "./api-core.schema.ts";
import { FieldsDataSchema } from "./field-shapes.schema.ts";

// ─── Cards ────────────────────────────────────────────────────────────────────

export const ApiCardSchema = z.object({
	id: z.string(),
	userId: z.string().nullable(),
	deckId: z.string().nullable(),
	premadeDeckId: z.string().nullable(),
	layoutType: layoutTypeSchema,
	fieldsData: FieldsDataSchema,
	parentCardId: z.string().nullable(),
	jlptLevel: jlptLevelSchema.nullable(),
	state: stateSchema,
	isSuspended: z.boolean(),
	due: z.string(),
	stability: z.number(),
	difficulty: z.number(),
	elapsedDays: z.number(),
	scheduledDays: z.number(),
	learningSteps: z.number(),
	reps: z.number(),
	lapses: z.number(),
	lastReview: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	// Optimistic-concurrency version. Bumped on every PATCH; sent back as
	// `If-Match: <version>` to gate the next update. List / due projections
	// intentionally omit this field — only the detail view drives PATCH.
	version: z.number(),
});

export const ApiDueCardSchema = ApiCardSchema.pick({
	id: true,
	deckId: true,
	jlptLevel: true,
	state: true,
	due: true,
	fieldsData: true,
	layoutType: true,
});

export const ApiCardListItemSchema = ApiCardSchema.pick({
	id: true,
	fieldsData: true,
	layoutType: true,
	jlptLevel: true,
	state: true,
	isSuspended: true,
	due: true,
});

// ─── Cross-deck card list ─────────────────────────────────────────────────────
//
// Powers `GET /api/v1/cards/cross-deck` (the /cards browser). Adds the
// joined `deckId` + `deckName` so the table can render a deck column
// without an N+1 deck-list lookup, and `lapses` so the sort=lapses option
// can show the metric directly in the row.

export const ApiCrossDeckCardListItemSchema = ApiCardListItemSchema.extend({
	deckId: z.string(),
	deckName: z.string(),
	lapses: z.number().int().nonnegative(),
});

// ─── Bulk mutation result ─────────────────────────────────────────────────────
//
// Bulk endpoints (`POST /api/v1/cards/bulk/*`) return per-id outcomes so
// the UI can show partial-success states. `failed` is empty on the
// happy path; populated when ownership checks reject some ids.

export const ApiBulkCardMutationResultSchema = z.object({
	succeeded: z.array(z.string()),
	failed: z.array(z.object({
		id: z.string(),
		error: z.string(),
		code: z.string().optional(),
	})),
});

export const ApiSimilarCardSchema = z.object({
	id: z.string(),
	deckId: z.string(),
	layoutType: layoutTypeSchema,
	fieldsData: FieldsDataSchema,
	jlptLevel: jlptLevelSchema.nullable(),
	similarity: z.number(),
});
