import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mock state ─────────────────────────────────────────────────────────────
//
// Same shape as weak-spot.service.test — a recursive proxy for the
// chained-builder calls (.from('cards').select(…).eq(…).single()) and a
// keyed queue for RPC responses.

interface CallRecord { method: string; args: readonly unknown[] }

interface MockState {
	responses: Record<string, Array<{ data: unknown; error: { message: string; code?: string } | null }>>;
	calls: CallRecord[];
	lastTable: string | null;
	terminalShape: "list" | "maybeSingle";
	rpcResponses: Record<string, Array<{ data: unknown; error: { message: string; code?: string } | null }>>;
	rpcCalls: Array<{ name: string; payload: unknown }>;
}

const state: MockState = {
	responses: {},
	calls: [],
	lastTable: null,
	terminalShape: "list",
	rpcResponses: {},
	rpcCalls: [],
};

function reset(): void {
	state.responses = {};
	state.calls = [];
	state.lastTable = null;
	state.terminalShape = "list";
	state.rpcResponses = {};
	state.rpcCalls = [];
}

function makeBuilder(table: string): unknown {
	const queue = state.responses[table] ?? [];
	const handler: ProxyHandler<{ then: unknown }> = {
		get(_target, prop) {
			if (prop === "then") {
				const next = queue.shift() ?? {
					data: state.terminalShape === "maybeSingle" ? null : [],
					error: null,
				};
				return (resolve: (v: unknown) => void): void => resolve(next);
			}
			if (prop === "maybeSingle" || prop === "single") {
				return (...args: readonly unknown[]): unknown => {
					state.calls.push({ method: String(prop), args });
					state.terminalShape = "maybeSingle";
					return builder;
				};
			}
			return (...args: readonly unknown[]): unknown => {
				state.calls.push({ method: String(prop), args });
				return builder;
			};
		},
	};
	const builder: unknown = new Proxy({ then: undefined }, handler);
	return builder;
}

mock.module("../../db/supabase.ts", () => ({
	supabaseAdmin: {
		from: mock((table: string) => {
			state.lastTable = table;
			return makeBuilder(table);
		}),
		rpc: mock(async (name: string, payload: unknown) => {
			state.rpcCalls.push({ name, payload });
			const queue = state.rpcResponses[name] ?? [];
			return queue.shift() ?? { data: null, error: null };
		}),
	},
}));

const {
	listCardsCrossDeck,
	moveCard,
	copyCard,
	suspendCard,
	unsuspendCard,
	bulkMoveCards,
	bulkSuspendCards,
	bulkDeleteCards,
} = await import("../card.service.ts");

beforeEach(() => reset());

// ── Helpers ────────────────────────────────────────────────────────────────

function uuid(): string { return randomUUID(); }

function makeCardRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
	return {
		id: uuid(),
		user_id: uuid(),
		deck_id: uuid(),
		premade_deck_id: null,
		layout_type: "vocabulary",
		fields_data: { word: "日本語" },
		parent_card_id: null,
		jlpt_level: "N5",
		state: 0,
		is_suspended: false,
		due: new Date().toISOString(),
		stability: 0,
		difficulty: 0,
		elapsed_days: 0,
		scheduled_days: 0,
		learning_steps: 0,
		reps: 0,
		lapses: 0,
		last_review: null,
		version: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		...over,
	};
}

function makeListRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
	return {
		id: uuid(),
		deck_id: uuid(),
		deck_name: "Daily core",
		fields_data: { word: "日本語", reading: "にほんご", meaning: "Japanese language" },
		layout_type: "vocabulary",
		jlpt_level: "N5",
		state: 0,
		is_suspended: false,
		due: new Date().toISOString(),
		lapses: 0,
		created_at: new Date().toISOString(),
		...over,
	};
}

// ── listCardsCrossDeck ─────────────────────────────────────────────────────

describe("card.service — listCardsCrossDeck", () => {
	it("projects RPC rows to ApiCrossDeckCardListItem and rolls in totalCount", async () => {
		state.rpcResponses.list_cards_cross_deck = [{ data: [makeListRow(), makeListRow()], error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 42, error: null }];

		const result = await listCardsCrossDeck(uuid(), { limit: 25 });

		expect(result.items).toHaveLength(2);
		expect(result.totalCount).toBe(42);
		// Offset pagination: hasMore = offset + shown < totalCount. Two rows shown
		// at offset 0 out of 42 total ⇒ more pages remain. (totalCount is kept
		// distinct from items.length so a regression that derives the footer total
		// from the page slice — rather than the count RPC — still fails here.)
		expect(result.hasMore).toBe(true);
		expect(result.items[0]).toHaveProperty("deckId");
		expect(result.items[0]).toHaveProperty("deckName");
		expect(result.items[0]).toHaveProperty("lapses");
	});

	it("passes filter params through to the RPC", async () => {
		state.rpcResponses.list_cards_cross_deck = [{ data: [], error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 0, error: null }];

		const userId = uuid();
		const deckId = uuid();
		await listCardsCrossDeck(userId, {
			limit: 50,
			deckId,
			status: "review",
			jlptLevel: "N3",
			search: "water",
			missingField: "mnemonic",
			sort: "lapses",
		});

		const listCall = state.rpcCalls.find(c => c.name === "list_cards_cross_deck");
		expect(listCall).toBeDefined();
		const payload = listCall?.payload as Record<string, unknown>;
		expect(payload.p_user_id).toBe(userId);
		expect(payload.p_deck_id).toBe(deckId);
		expect(payload.p_status).toBe("review");
		expect(payload.p_jlpt_level).toBe("N3");
		expect(payload.p_search).toBe("water");
		expect(payload.p_missing_field).toBe("mnemonic");
		expect(payload.p_sort).toBe("lapses");
		expect(payload.p_limit).toBe(50); // exact limit; offset pagination dropped the +1 probe
	});

	it("detects hasMore from totalCount when rows remain past the page", async () => {
		const rows = Array.from({ length: 5 }, () => makeListRow());
		state.rpcResponses.list_cards_cross_deck = [{ data: rows, error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 200, error: null }];

		const result = await listCardsCrossDeck(uuid(), { limit: 5 });

		expect(result.items).toHaveLength(5);
		expect(result.hasMore).toBe(true);
	});

	// ── hasMore page-size boundary (offset + shown vs totalCount) ──────────────
	// The matrix's empty/null/boundary cell: the off-by-one where a page lands
	// *exactly* on totalCount must read hasMore=false, not true. Asserting the
	// true side alone would pass a `<=`-vs-`<` regression.

	it("returns hasMore=false when the first page exactly exhausts totalCount", async () => {
		// 2 shown at offset 0, total 2 ⇒ 0 + 2 < 2 is false.
		state.rpcResponses.list_cards_cross_deck = [{ data: [makeListRow(), makeListRow()], error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 2, error: null }];

		const result = await listCardsCrossDeck(uuid(), { limit: 25 });

		expect(result.items).toHaveLength(2);
		expect(result.totalCount).toBe(2);
		expect(result.hasMore).toBe(false);
	});

	it("returns hasMore=false when a later offset page lands exactly on totalCount", async () => {
		// The offset arithmetic specifically: 25 shown at offset 25, total 50 ⇒
		// 25 + 25 < 50 is false. A regression that ignored offset (shown < total ⇒
		// 25 < 50 ⇒ true) would be caught here.
		const rows = Array.from({ length: 25 }, () => makeListRow());
		state.rpcResponses.list_cards_cross_deck = [{ data: rows, error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 50, error: null }];

		const result = await listCardsCrossDeck(uuid(), { limit: 25, offset: 25 });

		expect(result.hasMore).toBe(false);
	});

	it("returns hasMore=true when one row remains past an offset page", async () => {
		// 25 shown at offset 25, total 51 ⇒ 25 + 25 < 51 is true (one row left).
		const rows = Array.from({ length: 25 }, () => makeListRow());
		state.rpcResponses.list_cards_cross_deck = [{ data: rows, error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 51, error: null }];

		const result = await listCardsCrossDeck(uuid(), { limit: 25, offset: 25 });

		expect(result.hasMore).toBe(true);
	});

	it("forwards presentField and pitchPattern to both RPCs", async () => {
		state.rpcResponses.list_cards_cross_deck = [{ data: [], error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 0, error: null }];

		await listCardsCrossDeck(uuid(), {
			limit: 50,
			presentField: "picture",
			pitchPattern: "atamadaka",
		});

		const listCall = state.rpcCalls.find(c => c.name === "list_cards_cross_deck");
		const countCall = state.rpcCalls.find(c => c.name === "count_cards_cross_deck");
		const listPayload = listCall?.payload as Record<string, unknown>;
		const countPayload = countCall?.payload as Record<string, unknown>;

		expect(listPayload.p_present_field).toBe("picture");
		expect(listPayload.p_pitch_pattern).toBe("atamadaka");
		expect(listPayload.p_missing_field).toBeNull();
		// Count RPC must receive the same filter values so the footer total
		// never drifts from the visible page slice.
		expect(countPayload.p_present_field).toBe("picture");
		expect(countPayload.p_pitch_pattern).toBe("atamadaka");
		expect(countPayload.p_missing_field).toBeNull();
	});

	it("forwards extended missingField tokens (pitch)", async () => {
		state.rpcResponses.list_cards_cross_deck = [{ data: [], error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 0, error: null }];

		await listCardsCrossDeck(uuid(), { limit: 25, missingField: "pitch" });

		const listCall = state.rpcCalls.find(c => c.name === "list_cards_cross_deck");
		const listPayload = listCall?.payload as Record<string, unknown>;
		expect(listPayload.p_missing_field).toBe("pitch");
	});

	it("sends nulls for both filter directions when neither is set", async () => {
		state.rpcResponses.list_cards_cross_deck = [{ data: [], error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 0, error: null }];

		await listCardsCrossDeck(uuid(), { limit: 10 });

		const listCall = state.rpcCalls.find(c => c.name === "list_cards_cross_deck");
		const listPayload = listCall?.payload as Record<string, unknown>;
		expect(listPayload.p_missing_field).toBeNull();
		expect(listPayload.p_present_field).toBeNull();
		expect(listPayload.p_pitch_pattern).toBeNull();
	});

	it("forwards cross-direction combinations (missingField + presentField simultaneously)", async () => {
		// Migration 20260624000001 relaxed the mutual-exclusion guard. The
		// service does not enforce the prior constraint either; it forwards
		// whatever the validated schema admits.
		state.rpcResponses.list_cards_cross_deck = [{ data: [], error: null }];
		state.rpcResponses.count_cards_cross_deck = [{ data: 0, error: null }];

		await listCardsCrossDeck(uuid(), {
			limit: 25,
			presentField: "picture",
			missingField: "mnemonic",
		});

		const listCall = state.rpcCalls.find(c => c.name === "list_cards_cross_deck");
		const listPayload = listCall?.payload as Record<string, unknown>;
		expect(listPayload.p_present_field).toBe("picture");
		expect(listPayload.p_missing_field).toBe("mnemonic");

		const countCall = state.rpcCalls.find(c => c.name === "count_cards_cross_deck");
		const countPayload = countCall?.payload as Record<string, unknown>;
		expect(countPayload.p_present_field).toBe("picture");
		expect(countPayload.p_missing_field).toBe("mnemonic");
	});
});

// ── moveCard / copyCard / suspendCard / unsuspendCard ──────────────────────

describe("card.service — single-card mutations", () => {
	it("moveCard calls the RPC then re-fetches the card", async () => {
		const cardId = uuid();
		const userId = uuid();
		const deckId = uuid();
		state.rpcResponses.move_card = [{ data: cardId, error: null }];
		state.responses.cards = [{ data: makeCardRow({ id: cardId, user_id: userId, deck_id: deckId }), error: null }];

		const out = await moveCard(cardId, userId, deckId);

		const moveCall = state.rpcCalls.find(c => c.name === "move_card");
		expect(moveCall).toBeDefined();
		expect((moveCall?.payload as Record<string, unknown>).p_target_deck_id).toBe(deckId);
		expect(out.id).toBe(cardId);
	});

	it("moveCard maps 02000 card_not_found to a 404 AppError", async () => {
		state.rpcResponses.move_card = [{
			data: null,
			error: { code: "02000", message: "card_not_found" },
		}];

		await expect(moveCard(uuid(), uuid(), uuid())).rejects.toMatchObject({
			statusCode: 404,
			code: "CARD_NOT_FOUND",
		});
	});

	it("moveCard maps 02000 deck_not_found to a 404 AppError", async () => {
		state.rpcResponses.move_card = [{
			data: null,
			error: { code: "02000", message: "deck_not_found" },
		}];

		await expect(moveCard(uuid(), uuid(), uuid())).rejects.toMatchObject({
			statusCode: 404,
			code: "DECK_NOT_FOUND",
		});
	});

	it("copyCard returns the freshly-created card after the RPC", async () => {
		const newId = uuid();
		const userId = uuid();
		state.rpcResponses.copy_card = [{ data: newId, error: null }];
		state.responses.cards = [{ data: makeCardRow({ id: newId, user_id: userId }), error: null }];

		const out = await copyCard(uuid(), userId, uuid());
		expect(out.id).toBe(newId);
	});

	it("suspendCard / unsuspendCard each call their RPC and re-fetch", async () => {
		const cardId = uuid();
		const userId = uuid();

		state.rpcResponses.suspend_card = [{ data: cardId, error: null }];
		state.responses.cards = [
			{ data: makeCardRow({ id: cardId, user_id: userId, is_suspended: true }), error: null },
			{ data: makeCardRow({ id: cardId, user_id: userId, is_suspended: false }), error: null },
		];
		state.rpcResponses.unsuspend_card = [{ data: cardId, error: null }];

		const s = await suspendCard(cardId, userId);
		expect(s.isSuspended).toBe(true);

		const u = await unsuspendCard(cardId, userId);
		expect(u.isSuspended).toBe(false);
	});
});

// ── Bulk mutations ─────────────────────────────────────────────────────────

describe("card.service — bulk mutations", () => {
	it("bulkMoveCards parses {succeeded, failed} and returns it", async () => {
		const ok = uuid();
		const bad = uuid();
		state.rpcResponses.bulk_move_cards = [{
			data: {
				succeeded: [ok],
				failed: [{ id: bad, error: "Card does not exist or is not owned by this user.", code: "CARD_NOT_FOUND" }],
			},
			error: null,
		}];

		const out = await bulkMoveCards([ok, bad], uuid(), uuid());
		expect(out.succeeded).toEqual([ok]);
		expect(out.failed).toHaveLength(1);
		expect(out.failed[0]?.code).toBe("CARD_NOT_FOUND");
	});

	it("bulkSuspendCards forwards ids through the payload", async () => {
		const ids = [uuid(), uuid(), uuid()];
		state.rpcResponses.bulk_suspend_cards = [{
			data: { succeeded: ids, failed: [] },
			error: null,
		}];

		const out = await bulkSuspendCards(ids, uuid());
		expect(out.succeeded).toEqual(ids);
		expect(out.failed).toEqual([]);
		const call = state.rpcCalls.find(c => c.name === "bulk_suspend_cards");
		expect((call?.payload as Record<string, unknown>).p_card_ids).toEqual(ids);
	});

	it("bulkDeleteCards passes ids and returns partition", async () => {
		const id1 = uuid();
		const id2 = uuid();
		const ids = [id1, id2];
		state.rpcResponses.bulk_delete_cards = [{
			data: { succeeded: [id1], failed: [{ id: id2, error: "not yours", code: "CARD_NOT_FOUND" }] },
			error: null,
		}];

		const out = await bulkDeleteCards(ids, uuid());
		expect(out.succeeded).toHaveLength(1);
		expect(out.failed).toHaveLength(1);
	});

	it("bulk RPCs map an empty data payload to the empty partition shape", async () => {
		state.rpcResponses.bulk_suspend_cards = [{ data: null, error: null }];
		const out = await bulkSuspendCards([uuid()], uuid());
		expect(out.succeeded).toEqual([]);
		expect(out.failed).toEqual([]);
	});
});

// ── Module-load smoke ──────────────────────────────────────────────────────

describe("card.service", () => {
	it("imports without throwing", () => {
		expect(true).toBe(true);
	});
});
