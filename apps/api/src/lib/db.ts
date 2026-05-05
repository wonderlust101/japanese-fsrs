/**
 * Boundary helpers for supabase-js.
 *
 * supabase-js cannot infer row shapes when `.select()` is built at runtime
 * (e.g. `[...].join(', ')` to centralize column projections). It also types
 * `.update()` / `.insert()` / `.rpc()` payloads with exact-property checks
 * derived from the generated `Database` types, which reject our snake_case
 * partial patches even when shape-compatible at runtime.
 *
 * Use these helpers instead of inline `as unknown as T` / `as never` so the
 * boundary is documented in one place.
 */

/** Cast a Supabase row of unknown shape to a manually-maintained DB row interface. */
export function narrowRow<T>(row: unknown): T {
  return row as T
}

/** Coerce an update / insert / RPC payload to `never` to bypass over-strict generated types. */
export function asPayload<T>(payload: T): never {
  return payload as never
}
