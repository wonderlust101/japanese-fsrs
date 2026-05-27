import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Test scope ────────────────────────────────────────────────────────────────
//
// Unit coverage for deck.service:
//   - `copyDeck` (added 2026-05-18) — calls supabaseAdmin.rpc only.
//   - `archiveDeck` / `unarchiveDeck` / `assertDeckActive` (added 2026-05-19)
//     — call supabaseAdmin.from('decks') with builder chains.
//
// Both surfaces share one mock module. The `.from()` mock is a small
// chainable builder that the per-test setup can program: each .select()
// / .eq() / etc. returns `this`, terminating with `.maybeSingle()` /
// `.single()` / `.update()` which return the queued result. We stage the
// queued results via a FIFO so a multi-step archive flow (probe → update)
// drains in order.

interface CopyRpcRow {
	deck_id: string;
	card_count: number;
}

interface RpcResult<T> { data: T | null; error: { message: string; code?: string } | null }
interface FromCall { table: string; verb: "select" | "update"; eq: Record<string, unknown>; updateBody: Record<string, unknown> | null }

interface MockState {
	rpcResult: CopyRpcRow[] | null;
	rpcError: { message: string; code?: string } | null;
	rpcCalls: number;
	lastRpcName: string | null;
	lastRpcArgs: Record<string, unknown> | null;

	// FIFO of pre-staged .from() terminal results. Each archive/unarchive
	// flow does up to two terminal calls (probe + update), so per test we
	// push the results in call-order.
	fromQueue: Array<RpcResult<unknown>>;
	fromCalls: FromCall[];
}

const state: MockState = {
	rpcResult: null,
	rpcError: null,
	rpcCalls: 0,
	lastRpcName: null,
	lastRpcArgs: null,
	fromQueue: [],
	fromCalls: [],
};

function nextFromResult(): RpcResult<unknown> {
	const next = state.fromQueue.shift();
	if (next === undefined) {
		return { data: null, error: { message: "no result queued" } };
	}
	return next;
}

interface BuilderTerminator {
	data: unknown;
	error: { message: string; code?: string } | null;
}

function buildBuilder(table: string): unknown {
	const call: FromCall = { table, verb: "select", eq: {}, updateBody: null };
	state.fromCalls.push(call);
	const builder = {
		select(_cols?: string) { return builder; },
		update(body: Record<string, unknown>) { call.verb = "update"; call.updateBody = body; return builder; },
		delete() { return builder; },
		insert(_body: Record<string, unknown>) { return builder; },
		in(_col: string, _vals: readonly unknown[]) { return builder; },
		not(_col: string, _op: string, _val: unknown) { return builder; },
		order(_col: string, _opts?: unknown) { return builder; },
		limit(_n: number) { return builder; },
		eq(col: string, val: unknown) { call.eq[col] = val; return builder; },
		async maybeSingle(): Promise<BuilderTerminator> { return nextFromResult(); },
		async single(): Promise<BuilderTerminator> { return nextFromResult(); },
		// Some chains terminate without a marker (e.g. delete()) — await the
		// builder directly. Implemented via thenable.
		then(resolve: (v: BuilderTerminator) => void) { resolve(nextFromResult()); },
	};
	return builder;
}

mock.module("../../db/supabase.ts", () => ({
	supabaseAdmin: {
		rpc: mock(async (name: string, args: Record<string, unknown>) => {
			state.rpcCalls++;
			state.lastRpcName = name;
			state.lastRpcArgs = args;
			return { data: state.rpcResult, error: state.rpcError };
		}),
		from: mock((table: string) => buildBuilder(table)),
	},
}));

const { copyDeck, archiveDeck, unarchiveDeck, assertDeckActive, assertCardDeckActive } = await import("../deck.service.ts");

beforeEach(() => {
	state.rpcResult = null;
	state.rpcError = null;
	state.rpcCalls = 0;
	state.lastRpcName = null;
	state.lastRpcArgs = null;
	state.fromQueue = [];
	state.fromCalls = [];
});

// ─── copyDeck ────────────────────────────────────────────────────────────────

describe("deck.service — copyDeck", () => {
	it("returns the new deckId + cardCount when the RPC succeeds", async () => {
		state.rpcResult = [{ deck_id: "deck-new", card_count: 24 }];

		const result = await copyDeck("user-1", "deck-src");

		expect(result.deckId).toBe("deck-new");
		expect(result.cardCount).toBe(24);
		expect(state.rpcCalls).toBe(1);
		expect(state.lastRpcName).toBe("copy_user_deck");
	});

	it("passes the caller-supplied name through to the RPC", async () => {
		state.rpcResult = [{ deck_id: "deck-new", card_count: 0 }];

		await copyDeck("user-1", "deck-src", "  N5 Vocab (mine)  ");

		expect(state.lastRpcArgs?.p_target_name).toBe("  N5 Vocab (mine)  ");
	});

	it("passes p_target_name=null when no name is supplied", async () => {
		state.rpcResult = [{ deck_id: "deck-new", card_count: 0 }];

		await copyDeck("user-1", "deck-src");

		expect(state.lastRpcArgs?.p_target_name).toBeNull();
	});

	it("throws 404 (DECK_NOT_FOUND) when the RPC raises SQLSTATE 02000 with deck_not_found", async () => {
		state.rpcError = { message: "deck_not_found", code: "02000" };

		let captured: { statusCode: number; code?: string } | null = null;
		try {
			await copyDeck("user-1", "missing");
		} catch (err) {
			captured = err as { statusCode: number; code?: string };
		}
		expect(captured?.statusCode).toBe(404);
		expect(captured?.code).toBe("DECK_NOT_FOUND");
	});

	it("throws 500 (DECK_COPY_RPC_EMPTY) when the RPC returns no row", async () => {
		state.rpcResult = [];

		let captured: { statusCode: number; code?: string } | null = null;
		try {
			await copyDeck("user-1", "deck-src");
		} catch (err) {
			captured = err as { statusCode: number; code?: string };
		}
		expect(captured?.statusCode).toBe(500);
		expect(captured?.code).toBe("DECK_COPY_RPC_EMPTY");
	});

	it("surfaces a generic 5xx on any other RPC failure", async () => {
		state.rpcError = { message: "connection refused", code: "08006" };

		let captured: { statusCode: number } | null = null;
		try {
			await copyDeck("user-1", "deck-src");
		} catch (err) {
			captured = err as { statusCode: number };
		}
		expect(captured?.statusCode).toBeGreaterThanOrEqual(500);
	});

	it("allows duplicate copies — two calls produce two RPC invocations and distinct deck ids", async () => {
		state.rpcResult = [{ deck_id: "deck-a", card_count: 7 }];
		const first = await copyDeck("user-1", "deck-src");

		state.rpcResult = [{ deck_id: "deck-b", card_count: 7 }];
		const second = await copyDeck("user-1", "deck-src");

		expect(first.deckId).toBe("deck-a");
		expect(second.deckId).toBe("deck-b");
		expect(state.rpcCalls).toBe(2);
	});

	it("forwards user_id and source_deck_id to the RPC", async () => {
		state.rpcResult = [{ deck_id: "deck-new", card_count: 1 }];

		await copyDeck("user-42", "deck-source-uuid");

		expect(state.lastRpcArgs?.p_user_id).toBe("user-42");
		expect(state.lastRpcArgs?.p_source_deck_id).toBe("deck-source-uuid");
	});

	it("throws a Zod parse error when the RPC returns a row with a missing column", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		state.rpcResult = [{ deck_id: "deck-new" } as any];
		let thrown = false;
		try {
			await copyDeck("user-1", "deck-src");
		} catch {
			thrown = true;
		}
		expect(thrown).toBe(true);
	});
});

// ─── assertDeckActive ────────────────────────────────────────────────────────

const ACTIVE_PROBE = { data: { archived_at: null }, error: null };
const ARCHIVED_PROBE = { data: { archived_at: "2026-05-19T00:00:00Z" }, error: null };
const MISSING_PROBE = { data: null, error: null };

describe("deck.service — assertDeckActive", () => {
	it("resolves silently when the deck exists and is active", async () => {
		state.fromQueue.push(ACTIVE_PROBE);
		await assertDeckActive("deck-1", "user-1");
		expect(state.fromCalls.length).toBe(1);
	});

	it("throws 404 DECK_NOT_FOUND when the deck is missing or wrong-owner", async () => {
		state.fromQueue.push(MISSING_PROBE);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await assertDeckActive("deck-x", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(404);
		expect(captured?.code).toBe("DECK_NOT_FOUND");
	});

	it("throws 422 DECK_ARCHIVED when the deck is archived", async () => {
		state.fromQueue.push(ARCHIVED_PROBE);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await assertDeckActive("deck-1", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(422);
		expect(captured?.code).toBe("DECK_ARCHIVED");
	});
});

// ─── assertCardDeckActive ────────────────────────────────────────────────────
//
// Two-stage helper: probe `cards` for `deck_id`, then forward to
// `assertDeckActive`. Tests stage two queued results in order: the card
// lookup, then the deck probe.

const CARD_LOOKUP_OK = { data: { deck_id: "deck-1" }, error: null };
const CARD_LOOKUP_MISSING = { data: null, error: null };
const CARD_LOOKUP_ORPHAN = { data: { deck_id: null }, error: null };

describe("deck.service — assertCardDeckActive", () => {
	it("resolves silently when the card maps to an active deck", async () => {
		state.fromQueue.push(CARD_LOOKUP_OK);
		state.fromQueue.push(ACTIVE_PROBE);

		await assertCardDeckActive("card-1", "user-1");

		expect(state.fromCalls.length).toBe(2);
		expect(state.fromCalls[0]?.table).toBe("cards");
		expect(state.fromCalls[1]?.table).toBe("decks");
	});

	it("throws 404 CARD_NOT_FOUND when the card is missing or wrong-owner", async () => {
		state.fromQueue.push(CARD_LOOKUP_MISSING);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await assertCardDeckActive("card-x", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(404);
		expect(captured?.code).toBe("CARD_NOT_FOUND");
		// Short-circuited: no deck probe issued.
		expect(state.fromCalls.length).toBe(1);
	});

	it("throws 404 CARD_NOT_FOUND when the card row has a NULL deck_id", async () => {
		// Defensive: cards are normally NOT NULL on deck_id, but premade source
		// rows can be orphan-shaped under some historical migration paths.
		state.fromQueue.push(CARD_LOOKUP_ORPHAN);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await assertCardDeckActive("card-1", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(404);
		expect(captured?.code).toBe("CARD_NOT_FOUND");
	});

	it("throws 422 DECK_ARCHIVED when the card maps to an archived deck", async () => {
		state.fromQueue.push(CARD_LOOKUP_OK);
		state.fromQueue.push(ARCHIVED_PROBE);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await assertCardDeckActive("card-1", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(422);
		expect(captured?.code).toBe("DECK_ARCHIVED");
	});

	it("throws 404 DECK_NOT_FOUND when the card maps to a vanished deck", async () => {
		// Defensive: FK cascade should make this unreachable. The check exists
		// so the helper fails closed if the FK is ever relaxed.
		state.fromQueue.push(CARD_LOOKUP_OK);
		state.fromQueue.push(MISSING_PROBE);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await assertCardDeckActive("card-1", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(404);
		expect(captured?.code).toBe("DECK_NOT_FOUND");
	});
});

// ─── archive / unarchive ─────────────────────────────────────────────────────

const DECK_ROW_ACTIVE = {
	id: "deck-1",
	name: "Test deck",
	description: null,
	deck_type: "vocabulary",
	source_premade_id: null,
	card_count: 0,
	version: 1,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
	archived_at: null,
};
const DECK_ROW_ARCHIVED = { ...DECK_ROW_ACTIVE, archived_at: "2026-05-19T00:00:00Z" };

describe("deck.service — archiveDeck", () => {
	it("writes archived_at and returns the refreshed row when the deck is active", async () => {
		state.fromQueue.push(ACTIVE_PROBE);
		state.fromQueue.push({ data: DECK_ROW_ARCHIVED, error: null });

		const result = await archiveDeck("deck-1", "user-1");

		expect(result.archivedAt).toBe("2026-05-19T00:00:00Z");
		expect(state.fromCalls.length).toBe(2);
		// Probe was a select. Second call was the update with archived_at set.
		expect(state.fromCalls[1]?.verb).toBe("update");
		expect(state.fromCalls[1]?.updateBody?.archived_at).toEqual(expect.any(String));
	});

	it("is idempotent when already archived — returns the row, no update", async () => {
		state.fromQueue.push(ARCHIVED_PROBE);
		state.fromQueue.push({ data: DECK_ROW_ARCHIVED, error: null });

		const result = await archiveDeck("deck-1", "user-1");

		expect(result.archivedAt).toBe("2026-05-19T00:00:00Z");
		// Both calls are SELECTs; no UPDATE issued because the probe saw
		// archived_at != null and the function re-read the row instead.
		expect(state.fromCalls.length).toBe(2);
		expect(state.fromCalls[0]?.verb).toBe("select");
		expect(state.fromCalls[1]?.verb).toBe("select");
	});

	it("throws 404 DECK_NOT_FOUND when the deck is missing or wrong-owner", async () => {
		state.fromQueue.push(MISSING_PROBE);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await archiveDeck("deck-x", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(404);
		expect(captured?.code).toBe("DECK_NOT_FOUND");
	});
});

describe("deck.service — unarchiveDeck", () => {
	it("clears archived_at when the deck is archived", async () => {
		state.fromQueue.push(ARCHIVED_PROBE);
		state.fromQueue.push({ data: DECK_ROW_ACTIVE, error: null });

		const result = await unarchiveDeck("deck-1", "user-1");

		expect(result.archivedAt).toBeNull();
		expect(state.fromCalls.length).toBe(2);
		expect(state.fromCalls[1]?.verb).toBe("update");
		expect(state.fromCalls[1]?.updateBody?.archived_at).toBeNull();
	});

	it("is idempotent when already active — no UPDATE issued", async () => {
		state.fromQueue.push(ACTIVE_PROBE);
		state.fromQueue.push({ data: DECK_ROW_ACTIVE, error: null });

		const result = await unarchiveDeck("deck-1", "user-1");

		expect(result.archivedAt).toBeNull();
		expect(state.fromCalls[1]?.verb).toBe("select");
	});

	it("throws 404 DECK_NOT_FOUND when the deck is missing", async () => {
		state.fromQueue.push(MISSING_PROBE);
		let captured: { statusCode: number; code?: string } | null = null;
		try { await unarchiveDeck("deck-x", "user-1"); } catch (err) { captured = err as { statusCode: number; code?: string }; }
		expect(captured?.statusCode).toBe(404);
		expect(captured?.code).toBe("DECK_NOT_FOUND");
	});
});
