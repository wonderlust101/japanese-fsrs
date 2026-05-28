// Shared API-schema primitives: the enum bridges (layout / jlpt / deck /
// fsrs-state) and the generic batch-result + list-envelope helpers. Imported
// by the domain api-*.schema modules. Lifted out of api.schema.ts.

import { State } from "ts-fsrs";
import { z } from "zod";

import { JLPTLevel, LayoutType } from "../card.types.ts";
import { DeckType } from "../deck.types.ts";

// ─── Enum schemas (mirroring the const objects in shared-types) ───────────────

export const layoutTypeSchema = z.enum(Object.values(LayoutType) as [LayoutType, ...LayoutType[]]);
export const jlptLevelSchema = z.enum(Object.values(JLPTLevel) as [JLPTLevel, ...JLPTLevel[]]);
export const deckTypeSchema = z.enum(Object.values(DeckType) as [DeckType, ...DeckType[]]);
// ts-fsrs's State is a numeric enum — z.nativeEnum accepts numeric enums directly.
export const stateSchema = z.nativeEnum(State);

/** Generic batch result — caller passes the per-item schema. */
export function ApiBatchResultSchema<T>(item: z.ZodType<T>): z.ZodObject<{
	results: z.ZodArray<z.ZodType<T>>;
	errors: z.ZodArray<z.ZodObject<{ cardId: z.ZodString; error: z.ZodString }>>;
}> {
	return z.object({
		results: z.array(item),
		errors: z.array(z.object({ cardId: z.string(), error: z.string() })),
	});
}

/**
 * Universal list response envelope. Every endpoint that returns a list of
 * resources wraps its items in this shape. `nextCursor` is null and
 * `hasMore` is false on endpoints that aren't actually cursor-paginated
 * (bounded responses, fixed-dimension analytics arrays); the shape stays
 * uniform so adding pagination later is non-breaking.
 */
export function apiListEnvelope<T>(item: z.ZodType<T>): z.ZodObject<{
	items: z.ZodArray<z.ZodType<T>>;
	nextCursor: z.ZodNullable<z.ZodString>;
	hasMore: z.ZodBoolean;
	totalCount: z.ZodOptional<z.ZodNumber>;
}> {
	return z.object({
		items: z.array(item),
		nextCursor: z.string().nullable(),
		hasMore: z.boolean(),
		totalCount: z.number().optional(),
	});
}
