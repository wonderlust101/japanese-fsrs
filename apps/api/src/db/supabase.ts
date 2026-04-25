import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['SUPABASE_URL']
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl) throw new Error('SUPABASE_URL environment variable is not set')
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set')

/**
 * Service-role Supabase client. Bypasses RLS — use only after the request's
 * auth middleware has already verified the caller's identity.
 * Never expose this client or its key to the browser or frontend.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
