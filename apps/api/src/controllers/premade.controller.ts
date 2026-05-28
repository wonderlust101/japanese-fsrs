import type { ApiCopyPremadeDeckResult } from "@fsrs-japanese/shared-types";

import type { RequestHandler } from "express";
import { cacheControl } from "../lib/http.ts";
import { withIdempotency } from "../lib/idempotency.ts";
import {
	listPremadeDecksQuerySchema,
	premadeDeckIdParamSchema,
} from "../schemas/premade.schema.ts";
import { emptyBodySchema } from "../schemas/weak-spot.schema.ts";
import * as premadeService from "../services/premade.service.ts";

const PREMADE_MAX_AGE_SECONDS = 600;

/**
 * GET /api/v1/premade-decks
 * Returns active premade decks, optionally filtered.
 */
export const list: RequestHandler = async (req, res): Promise<void> => {
	const filters = listPremadeDecksQuerySchema.parse(req.query);
	const data = await premadeService.listPremadeDecks(filters);
	// `public`: premade decks are global (user_id IS NULL, no per-user fields in
	// listPremadeDecks/getPremadeDeck), so a shared CDN/proxy may cache one copy
	// for every authenticated caller. Per-user endpoints stay `private`.
	cacheControl(res, PREMADE_MAX_AGE_SECONDS, "public");
	res.json(data);
};

/**
 * GET /api/v1/premade-decks/:id
 * Returns a single active premade deck.
 */
export const get: RequestHandler = async (req, res): Promise<void> => {
	const { id } = premadeDeckIdParamSchema.parse(req.params);
	const data = await premadeService.getPremadeDeck(id);
	// `public`: premade decks are global (user_id IS NULL, no per-user fields in
	// listPremadeDecks/getPremadeDeck), so a shared CDN/proxy may cache one copy
	// for every authenticated caller. Per-user endpoints stay `private`.
	cacheControl(res, PREMADE_MAX_AGE_SECONDS, "public");
	res.json(data);
};

/**
 * POST /api/v1/premade-decks/:id/copy
 *
 * Backend Completion Plan Stage 4 (copy model) — replaces the prior
 * `/subscribe` route. Copies a premade deck into a new standalone deck
 * owned by the user. Returns 201 with the new deckId + cardCount, plus a
 * `Location` header pointing at the new deck.
 *
 * Requires `Idempotency-Key`: copy is the largest-blast-radius write in
 * the API (clones every source card). Same key + same premadeDeckId →
 * replay the original 201 response without re-cloning. Deliberate
 * duplicate copies use distinct idempotency keys and produce independent
 * decks — that's intentional under the copy model.
 *
 * Body must be empty (`.strict()`); copy takes no parameters beyond the
 * route param.
 */
export const copy: RequestHandler = async (req, res): Promise<void> => {
	const { id } = premadeDeckIdParamSchema.parse(req.params);
	emptyBodySchema.parse(req.body ?? {});

	const { status, body } = await withIdempotency<ApiCopyPremadeDeckResult>(
		req.user.id,
		req.header("idempotency-key"),
		{ premadeDeckId: id },
		async () => {
			const data = await premadeService.copyPremadeDeck(req.user.id, id);
			return { status: 201, body: data };
		},
	);
	if (status === 201) {
		res.setHeader("Location", `/api/v1/decks/${body.deckId}`);
	}
	res.status(status).json(body);
};
