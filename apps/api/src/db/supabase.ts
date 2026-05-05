import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import { env } from '../lib/env.ts'

/**
 * Service-role Supabase client. Bypasses RLS — use only after the request's
 * auth middleware has already verified the caller's identity.
 * Never expose this client or its key to the browser or frontend.
 */
export const supabaseAdmin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
