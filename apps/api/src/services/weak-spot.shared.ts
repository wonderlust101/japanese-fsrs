// Shared weak-spot service helpers: PostgREST column projections, the row
// validation schemas, and the raw-row -> ApiWeakSpotListItem mapper. Consumed
// by the listing + diagnosis services. Lifted out of weak-spot.service.ts.

import type { ApiWeakSpotListItem, FieldsData } from "@fsrs-japanese/shared-types";
import { getWordFields } from "@fsrs-japanese/shared-types";
import { z } from "zod";

// ─── Column projections ───────────────────────────────────────────────────────
//
// PostgREST embedded-select syntax. The relationships are inferred from the
// foreign keys: `weakSpots.card_id → cards.id` and `cards.deck_id → decks.id`,
// so the embed names are `cards` and `decks`. Never use `select('*')` — it
// keeps PII out of accidental log dumps and lets the schema evolve.
//
// The embed defaults to a LEFT JOIN so weakSpots with `card_id IS NULL`
// (preserved-after-card-deletion, per migration 20260425000001) still appear
// in the list view. When a card-side filter is applied we swap to
// `cards!inner` so non-matching cards drop the parent row instead of
// surfacing as a weakSpot with `card: null`.

export function weakSpotSelect(innerJoin: boolean): string {
	const cardEmbed = innerJoin ? "cards!inner" : "cards";
	return `
    id,
    card_id,
    diagnosis,
    prescription,
    resolved,
    resolved_at,
    created_at,
    card:${cardEmbed} (
      deck_id,
      fields_data,
      layout_type,
      jlpt_level,
      lapses,
      reps,
      due,
      last_review,
      is_suspended,
      deck:decks ( name )
    )
  `;
}

export const WEAK_SPOT_SELECT_LEFT = weakSpotSelect(false);
export const WEAK_SPOT_SELECT_INNER = weakSpotSelect(true);

// ─── Row schemas ──────────────────────────────────────────────────────────────
//
// Parse every Supabase response with a Zod schema so silent column drift
// surfaces as a clean ZodError instead of an `undefined` at the wire boundary.
// Mirrors the precedent set in analytics.service.ts / deck.service.ts.

export const WeakSpotDeckRowSchema = z.object({
	name: z.string(),
}).nullable();

export const WeakSpotCardRowSchema = z.object({
	deck_id: z.string().uuid(),
	fields_data: z.record(z.string(), z.unknown()),
	layout_type: z.enum(["vocabulary", "grammar", "sentence"]),
	jlpt_level: z.enum(["N5", "N4", "N3", "N2", "N1", "beyond_jlpt"]).nullable(),
	lapses: z.number().int().nonnegative(),
	reps: z.number().int().nonnegative(),
	due: z.string(),
	last_review: z.string().nullable(),
	is_suspended: z.boolean(),
	deck: WeakSpotDeckRowSchema,
}).nullable();

export const WeakSpotRowSchema = z.object({
	id: z.string().uuid(),
	card_id: z.string().uuid().nullable(),
	diagnosis: z.string().nullable(),
	prescription: z.string().nullable(),
	resolved: z.boolean(),
	resolved_at: z.string().nullable(),
	created_at: z.string(),
	card: WeakSpotCardRowSchema,
});

/**
 * Internal row type. Exported solely so the unit test can type its fixtures
 *  without redeclaring the joined-row shape. Not part of the public API.
 */
export type WeakSpotRow = z.infer<typeof WeakSpotRowSchema>;

// ─── Mappers ──────────────────────────────────────────────────────────────────

/**
 * Snake_case DB row → camelCase wire shape. Card-derived fields fall back to
 * null when the joined card row is absent (orphaned weakSpot: card was deleted
 * but the weakSpot is kept as historical learning data, per [[DATABASE]]).
 */
export function toListItem(raw: WeakSpotRow): ApiWeakSpotListItem {
	const card = raw.card;

	let word: string | null = null;
	let reading: string | null = null;
	let meaning: string | null = null;

	if (card !== null) {
		// `getWordFields` returns null for sentence-layout cards; vocabulary and
		// grammar both expose word/reading/meaning via WordFields.
		const fields = getWordFields({
			// layout_type is already narrowed to LayoutType by WeakSpotCardRowSchema;
			// only fields_data needs the (load-bearing) FieldsData cast — see the
			// diagnoseWeakSpot note below for why the CHECK constraint, not Zod, is
			// the runtime guarantee.
			layoutType: card.layout_type,
			fieldsData: card.fields_data as FieldsData,
		});
		if (fields !== null) {
			word = fields.word;
			reading = fields.reading;
			meaning = fields.meaning;
		}
	}

	return {
		id: raw.id,
		cardId: raw.card_id,
		deckId: card?.deck_id ?? null,
		deckName: card?.deck?.name ?? null,
		word,
		reading,
		meaning,
		layoutType: card?.layout_type ?? null,
		jlptLevel: card?.jlpt_level ?? null,
		lapses: card?.lapses ?? null,
		reps: card?.reps ?? null,
		due: card?.due ?? null,
		lastReview: card?.last_review ?? null,
		diagnosis: raw.diagnosis,
		prescription: raw.prescription,
		resolved: raw.resolved,
		resolvedAt: raw.resolved_at,
		createdAt: raw.created_at,
	};
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns an offset-paginated list of the authenticated user's weakSpots,
 * plus the full `totalCount` of rows matching the active filters.
 *
 * Sort modes:
 *   - 'mostRecent'       (default) — ORDER BY created_at DESC, id DESC
 *   - 'oldestUnresolved'           — ORDER BY created_at ASC,  id ASC
 *   - 'mostLapses'                 — ORDER BY card.lapses DESC NULLS LAST,
 *                                             created_at DESC, id DESC
 *   - 'deckOrder'                  — ORDER BY card.deck_id ASC,
 *                                             created_at DESC, id DESC
 *
 * Pagination is a single offset window (`.range(offset, offset + limit - 1)`)
 * with an exact head count, matching the cross-deck cards list. This replaced
 * the earlier keyset-cursor model: cursors only ever worked for the two
 * time-keyed sorts (the card-side sorts threw `CURSOR_INVALID`), so offset
 * paging unifies all four orders behind one code path. The trade-off is the
 * usual offset one (a concurrent insert can shift a row across a page
 * boundary), acceptable for a low-churn insights list.
 *
 * Filter dimensions (`status`, `deckId`, `jlptLevel`) all apply at the SQL
 * `WHERE` clause boundary. The `diagnosis` filter is in the same shape but
 * lives on `weakSpots` itself, not on the joined card row, so it does not
 * trigger the LEFT→INNER join switch that the card-side filters do.
 */
