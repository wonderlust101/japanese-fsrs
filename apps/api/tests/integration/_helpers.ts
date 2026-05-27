import { describe } from 'bun:test'

/**
 * Integration tests need a real Supabase instance.
 * Gate on a non-stub SUPABASE_URL so CI/local can opt in by setting it.
 */
export function isIntegrationEnabled(): boolean {
  const url = process.env['SUPABASE_URL']
  return url !== undefined && url.length > 0 && url !== 'https://test-supabase'
}

/** describe block that runs only when integration env vars are real. */
export const describeIntegration: typeof describe = isIntegrationEnabled()
  ? describe
  : describe.skip

// ─── Service-role seeding via raw PostgREST ──────────────────────────────────
//
// Direct fixture seeds of SYSTEM rows (premade_decks, user_id=NULL source
// cards) and cross-user rows must run as service_role to bypass RLS. The
// supabase-js client does not reliably present the service_role bearer against
// the local stack (a raw curl with the same key bypasses RLS, but the client
// hits "violates row-level security policy"), so these helpers issue raw fetch
// calls that mirror the working curl: apikey + Authorization: Bearer <key>.

const restBase = (): { url: string; key: string } => ({
  url: process.env['SUPABASE_URL'] ?? '',
  key: process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
})

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` }
}

/** Insert one row or an array of rows as service_role. Throws on non-2xx. */
export async function restSeed(table: string, rows: unknown): Promise<void> {
  const { url, key } = restBase()
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...authHeaders(key), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body:    JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`restSeed ${table} failed: ${res.status} ${await res.text()}`)
}

/** Call a SECURITY DEFINER RPC as service_role. Throws on non-2xx. */
export async function restRpc(fn: string, args: Record<string, unknown> = {}): Promise<void> {
  const { url, key } = restBase()
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method:  'POST',
    headers: { ...authHeaders(key), 'Content-Type': 'application/json' },
    body:    JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`restRpc ${fn} failed: ${res.status} ${await res.text()}`)
}

/** Read rows as service_role (RLS-bypassing). `query` is a raw PostgREST query
 *  string, e.g. `user_id=eq.<uuid>&select=user_id,mature_count`. */
export async function restSelect<T = Record<string, unknown>>(table: string, query: string): Promise<T[]> {
  const { url, key } = restBase()
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: authHeaders(key) })
  if (!res.ok) throw new Error(`restSelect ${table} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T[]>
}

/** Best-effort cleanup delete as service_role. `filter` is a raw PostgREST
 *  query string, e.g. `id=eq.<uuid>`. Swallows errors. */
export async function restDelete(table: string, filter: string): Promise<void> {
  const { url, key } = restBase()
  await fetch(`${url}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: authHeaders(key) })
    .catch(() => undefined)
}
