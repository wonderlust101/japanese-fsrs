/**
 * Boundary helper for supabase-js.
 *
 * supabase-js types `.update()` / `.insert()` / `.rpc()` payloads with exact-
 * property checks derived from the generated `Database` types, which reject
 * snake_case partial patches built dynamically at runtime even when they're
 * shape-compatible.
 *
 * Inbound paths (rows returned from `.select()` / `.rpc()`) are validated at
 * runtime via Zod schemas in each service file — there is no `narrowRow`
 * type-only escape hatch. Outbound payloads use `asPayload` below.
 */

/** Coerce an update / insert / RPC payload to `never` to bypass over-strict generated types. */
export function asPayload<T>(payload: T): never {
	return payload as never;
}
