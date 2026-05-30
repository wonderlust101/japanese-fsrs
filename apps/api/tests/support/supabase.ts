/**
 * In-memory stand-in for `db/supabase.ts`'s `supabaseAdmin`. Replicates the
 * supabase-js builder — `.from(table).select(...).eq(...).maybeSingle()`
 * resolves to a queued `{ data, error }` — and `.rpc(name, payload)` pops from
 * a per-name queue. Every builder method and rpc call is recorded so tests can
 * assert request construction (filters, snake_case params), not just results.
 *
 * Consolidates the recursive-proxy mock previously copy-pasted across the
 * card / deck / weak-spot suites.
 *
 *   const sb = createSupabaseHarness()
 *   mock.module('../../db/supabase.ts', () => ({ supabaseAdmin: sb.supabaseAdmin }))
 *   beforeEach(() => sb.reset())
 *
 *   sb.state.responses['cards']        = [{ data: cardRow, error: null }]
 *   sb.state.rpcResponses['move_card'] = [{ data: 'card-1', error: null }]
 *
 * Tables can be keyed by their snake_case name or a camelCase alias (a
 * `from('weak_spots')` call also finds `responses['weakSpots']`).
 */

export interface QueryResult {
	data: unknown;
	error: { message: string; code?: string } | null;
	count?: number | null;
}

export interface CallRecord { method: string; args: readonly unknown[] }
export interface RpcCall { name: string; payload: unknown }

export interface SupabaseHarnessState {
	/** FIFO of terminal results per table (drained in call order). */
	responses: Record<string, QueryResult[]>;
	/** FIFO of results per RPC name. */
	rpcResponses: Record<string, QueryResult[]>;
	/** Every builder method invoked (`select`, `eq`, `order`, …) with its args. */
	calls: CallRecord[];
	/** Every `rpc(name, payload)` invocation. */
	rpcCalls: RpcCall[];
	lastTable: string | null;
}

export interface SupabaseHarness {
	supabaseAdmin: {
		from: (table: string) => unknown;
		rpc: (name: string, payload?: unknown) => Promise<QueryResult>;
	};
	state: SupabaseHarnessState;
	reset: () => void;
}

function toCamelTable(table: string): string {
	return table.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
}

// supabase-js `.single()` resolves zero rows to a PGRST116 *error* (not the
// null-without-error that `.maybeSingle()` returns). Modeling that here means a
// service that uses `.single()` and mishandles the not-found error path is
// caught by tests instead of only misbehaving in production (see the M1 fix).
const PGRST116: QueryResult = {
	data: null,
	error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
};

/** True for a null/undefined scalar or an empty array — i.e. "zero rows". */
function isEmptyData(data: unknown): boolean {
	return data == null || (Array.isArray(data) && data.length === 0);
}

export function createSupabaseHarness(): SupabaseHarness {
	const state: SupabaseHarnessState = {
		responses: {},
		rpcResponses: {},
		calls: [],
		rpcCalls: [],
		lastTable: null,
	};

	function makeBuilder(table: string): unknown {
		const queue = state.responses[table] ?? state.responses[toCamelTable(table)] ?? [];
		// Per-builder terminal shape (NOT shared state): each `.from()` starts a
		// fresh query, so a `.single()` on one query must never influence a
		// parallel (Promise.all) or subsequent query's default or zero-rows handling.
		let terminalShape: "list" | "maybeSingle" | "single" = "list";

		const handler: ProxyHandler<{ then: unknown }> = {
			get(_target, prop) {
				if (prop === "then") {
					let next = queue.shift();
					if (next === undefined) {
						// No queued response — synthesize a per-terminal default.
						next = terminalShape === "single"
							? PGRST116
							: { data: terminalShape === "maybeSingle" ? null : [], error: null };
					} else if (terminalShape === "single" && next.error === null && isEmptyData(next.data)) {
						// A queued null/empty result on a `.single()` terminal models
						// zero rows, which supabase-js surfaces as a PGRST116 error.
						next = PGRST116;
					}
					return (resolve: (v: unknown) => void): void => { resolve(next); };
				}
				if (prop === "single") {
					return (...args: readonly unknown[]): unknown => {
						state.calls.push({ method: "single", args });
						terminalShape = "single";
						return builder;
					};
				}
				if (prop === "maybeSingle") {
					return (...args: readonly unknown[]): unknown => {
						state.calls.push({ method: "maybeSingle", args });
						terminalShape = "maybeSingle";
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

	const supabaseAdmin = {
		from: (table: string): unknown => {
			state.lastTable = table;
			return makeBuilder(table);
		},
		rpc: async (name: string, payload?: unknown): Promise<QueryResult> => {
			state.rpcCalls.push({ name, payload });
			const queue = state.rpcResponses[name] ?? [];
			return queue.shift() ?? { data: null, error: null };
		},
	};

	return {
		supabaseAdmin,
		state,
		reset: () => {
			state.responses = {};
			state.rpcResponses = {};
			state.calls = [];
			state.rpcCalls = [];
			state.lastTable = null;
		},
	};
}
