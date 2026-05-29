import type { ApiCard, ApiCardListItem, ApiDueCard, FieldsData, JLPTLevel, LayoutType } from "@fsrs-japanese/shared-types";
import { jlptLevelEnum, layoutTypeEnum, State } from "@fsrs-japanese/shared-types";

import { z } from "zod";

// ─── Column projection ────────────────────────────────────────────────────────
// Excludes tokens, parsed_at, embedding — internal/heavy fields not needed by clients.

export const CARD_COLUMNS = [
	"id",
	"user_id",
	"deck_id",
	"premade_deck_id",
	"layout_type",
	"fields_data",
	"parent_card_id",
	"jlpt_level",
	"state",
	"is_suspended",
	"due",
	"stability",
	"difficulty",
	"elapsed_days",
	"scheduled_days",
	"learning_steps",
	"reps",
	"lapses",
	"last_review",
	"version",
	"created_at",
	"updated_at",
].join(", ");

// Slim projection for the review session — only the fields the UI renders.
// Mirrors ApiDueCard in shared-types. Keeps FSRS internals (stability,
// difficulty, reps, lapses, …) off the wire during reviews.
export const DUE_CARD_COLUMNS = [
	"id",
	"deck_id",
	"jlpt_level",
	"state",
	"due",
	"fields_data",
	"layout_type",
].join(", ");

// Slim projection for the deck card-browser list — mirrors ApiCardListItem.
export const CARD_LIST_COLUMNS = [
	"id",
	"fields_data",
	"layout_type",
	"jlpt_level",
	"state",
	"is_suspended",
	"due",
].join(", ");

// ─── Return shapes ────────────────────────────────────────────────────────────

export interface CardListResult {
	items: ApiCardListItem[];
	nextCursor: string | null;
	hasMore: boolean;
	totalCount: number;
}

export interface CreateCardMeta {
	layoutType: LayoutType;
	jlptLevel: JLPTLevel | undefined;
	parentCardId: string | undefined;
}

// ─── RPC envelope schemas ─────────────────────────────────────────────────────
// Module-level Zod schemas for the RPC return shapes consumed below. Mirrors
// the precedent in analytics.service.ts and review.service.ts: parsed at
// runtime so any future column-rename surfaces as a clean ZodError instead of
// silently propagating bad data.

/** Master schema mirroring CardDbRow (full SELECT CARD_COLUMNS shape). */
export const CardDbRowSchema = z.object({
	id: z.string(),
	user_id: z.string().nullable(),
	deck_id: z.string().nullable(),
	premade_deck_id: z.string().nullable(),
	layout_type: layoutTypeEnum,
	fields_data: z.record(z.string(), z.unknown()),
	parent_card_id: z.string().nullable(),
	jlpt_level: jlptLevelEnum.nullable(),
	state: z.nativeEnum(State),
	is_suspended: z.boolean(),
	due: z.string(),
	stability: z.number(),
	difficulty: z.number(),
	elapsed_days: z.number(),
	scheduled_days: z.number(),
	learning_steps: z.number(),
	reps: z.number(),
	lapses: z.number(),
	last_review: z.string().nullable(),
	version: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
});

/**
 * Raw snake_case row shape returned by SELECT CARD_COLUMNS. Inferred from
 *  CardDbRowSchema — the schema is the single source of truth.
 */
export type CardDbRow = z.infer<typeof CardDbRowSchema>;

export function toCardRow(raw: CardDbRow): ApiCard {
	return {
		id: raw.id,
		userId: raw.user_id,
		deckId: raw.deck_id,
		premadeDeckId: raw.premade_deck_id,
		layoutType: raw.layout_type,
		fieldsData: raw.fields_data as FieldsData,
		parentCardId: raw.parent_card_id,
		jlptLevel: raw.jlpt_level,
		state: raw.state,
		isSuspended: raw.is_suspended,
		due: raw.due,
		stability: raw.stability,
		difficulty: raw.difficulty,
		elapsedDays: raw.elapsed_days,
		scheduledDays: raw.scheduled_days,
		learningSteps: raw.learning_steps,
		reps: raw.reps,
		lapses: raw.lapses,
		lastReview: raw.last_review,
		version: raw.version,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
	};
}

/** Raw snake_case row shape returned by SELECT DUE_CARD_COLUMNS. */
export type DueCardDbRow = Pick<
	CardDbRow,
  "id" | "deck_id" | "jlpt_level" | "state" | "due" | "fields_data" | "layout_type"
>;

/** Maps a DUE_CARD_COLUMNS row to the wire-format ApiDueCard. */
export function toApiDueCard(raw: DueCardDbRow): ApiDueCard {
	return {
		id: raw.id,
		deckId: raw.deck_id,
		jlptLevel: raw.jlpt_level,
		state: raw.state,
		due: raw.due,
		fieldsData: raw.fields_data as FieldsData,
		layoutType: raw.layout_type,
	};
}

/** Raw snake_case row shape returned by SELECT CARD_LIST_COLUMNS. */
export type CardListDbRow = Pick<
	CardDbRow,
  "id" | "fields_data" | "layout_type" | "jlpt_level" | "state" | "is_suspended" | "due"
>;

/** Maps a CARD_LIST_COLUMNS row to the wire-format ApiCardListItem. */
export function toApiCardListItem(raw: CardListDbRow): ApiCardListItem {
	return {
		id: raw.id,
		fieldsData: raw.fields_data as FieldsData,
		layoutType: raw.layout_type,
		jlptLevel: raw.jlpt_level,
		state: raw.state,
		isSuspended: raw.is_suspended,
		due: raw.due,
	};
}

/**
 * Slim projection returned by the `get_due_cards` RPC. Exported so
 * review.service.ts can validate the same shape without redefining it.
 */
export const DueCardRpcRowSchema = CardDbRowSchema.pick({
	id: true,
	deck_id: true,
	jlpt_level: true,
	state: true,
	due: true,
	fields_data: true,
	layout_type: true,
});
