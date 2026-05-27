import type { ApiCopyDeckResult, ApiDeck } from "@fsrs-japanese/shared-types";

import type { RequestHandler } from "express";
import {
	archiveDeckSchema,
	copyDeckSchema,
	createDeckSchema,
	deckIdParamSchema,
	listDecksQuerySchema,
	updateDeckSchema,

} from "@fsrs-japanese/shared-types";
import { parseIfMatchVersion } from "../lib/http.ts";
import { withIdempotency } from "../lib/idempotency.ts";
import * as deckService from "../services/deck.service.ts";

export const list: RequestHandler = async (req, res): Promise<void> => {
	const { limit, cursor, view } = listDecksQuerySchema.parse(req.query);
	const result = await deckService.listDecks(req.user.id, limit, cursor, view);
	res.json(result);
};

export const get: RequestHandler = async (req, res): Promise<void> => {
	const { id } = deckIdParamSchema.parse(req.params);
	const deck = await deckService.getDeck(id, req.user.id);
	res.json(deck);
};

export const create: RequestHandler = async (req, res): Promise<void> => {
	const input = createDeckSchema.parse(req.body);
	const { status, body } = await withIdempotency<ApiDeck>(
		req.user.id,
		req.header("idempotency-key"),
		input,
		async () => {
			const deck = await deckService.createDeck(req.user.id, input);
			return { status: 201, body: deck };
		},
	);
	if (status === 201) {
		res.setHeader("Location", `/api/v1/decks/${body.id}`);
	}
	res.status(status).json(body);
};

export const update: RequestHandler = async (req, res): Promise<void> => {
	const { id } = deckIdParamSchema.parse(req.params);
	const input = updateDeckSchema.parse(req.body);
	const expectedVersion = parseIfMatchVersion(req.header("if-match"));
	// PATCH is a content edit; archived decks are frozen except for the
	// archive lifecycle + delete. The 422 `DECK_ARCHIVED` shape lets the
	// frontend show "unarchive first" without parsing error strings.
	await deckService.assertDeckActive(id, req.user.id);
	const deck = await deckService.updateDeck(id, req.user.id, input, expectedVersion);
	res.json(deck);
};

export const remove: RequestHandler = async (req, res): Promise<void> => {
	const { id } = deckIdParamSchema.parse(req.params);
	await deckService.deleteDeck(id, req.user.id);
	res.status(204).end();
};

/**
 * POST /api/v1/decks/:id/copy
 *
 * Duplicates a user-owned deck. Optional `name` body field overrides the
 * server's default "<source> (Copy)" naming. Returns 201 with the new
 * `{ deckId, cardCount }` plus a `Location` header pointing at the new deck.
 *
 * Mirrors the premade-copy controller shape:
 *   - Idempotency-Key required by convention — copy is a large-blast-radius
 *     write (clones every non-suspended source card). Same key + same body
 *     → replay original response. Deliberate duplicates use a new key.
 *   - Body is `.strict()` so unknown keys are rejected up front.
 *   - Premade source decks and cross-user attempts both fail closed as
 *     404 `DECK_NOT_FOUND` (see service for the no-ownership-leak rationale).
 */
export const copy: RequestHandler = async (req, res): Promise<void> => {
	const { id } = deckIdParamSchema.parse(req.params);
	const { name } = copyDeckSchema.parse(req.body ?? {});

	// Copying an archived deck is blocked. The user has the unarchive +
	// delete escape hatches; "copy this frozen deck" would smuggle the
	// archived state into a new active deck and surprise the user.
	await deckService.assertDeckActive(id, req.user.id);

	const { status, body } = await withIdempotency<ApiCopyDeckResult>(
		req.user.id,
		req.header("idempotency-key"),
		{ sourceDeckId: id, name: name ?? null },
		async () => {
			const data = await deckService.copyDeck(req.user.id, id, name);
			return { status: 201, body: data };
		},
	);
	if (status === 201) {
		res.setHeader("Location", `/api/v1/decks/${body.deckId}`);
	}
	res.status(status).json(body);
};

/**
 * POST /api/v1/decks/:id/archive
 *
 * Sets the deck's `archived_at` timestamp so it disappears from the active
 * listing, the review queue, and every write path that flows through
 * `assertDeckActive`. Idempotent: archiving an already-archived deck is a
 * no-op (returns the existing row, original timestamp intact).
 *
 * No `Idempotency-Key` requirement — archive is a pure state-flip with no
 * side-effects beyond the `archived_at` write, and the idempotency comes
 * from the operation itself.
 */
export const archive: RequestHandler = async (req, res): Promise<void> => {
	const { id } = deckIdParamSchema.parse(req.params);
	archiveDeckSchema.parse(req.body ?? {});

	const deck = await deckService.archiveDeck(id, req.user.id);
	res.json(deck);
};

/**
 * POST /api/v1/decks/:id/unarchive
 *
 * Clears `archived_at`, restoring the deck to the active listing and the
 * review queue. Idempotent: unarchiving an already-active deck is a no-op.
 */
export const unarchive: RequestHandler = async (req, res): Promise<void> => {
	const { id } = deckIdParamSchema.parse(req.params);
	archiveDeckSchema.parse(req.body ?? {});

	const deck = await deckService.unarchiveDeck(id, req.user.id);
	res.json(deck);
};
