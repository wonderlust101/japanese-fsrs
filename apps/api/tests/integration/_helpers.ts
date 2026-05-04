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
