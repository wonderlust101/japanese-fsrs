/**
 * Validates and exports the web app's environment variables at module load.
 * Importing this module fails fast with a Zod error if any required var is
 * missing or malformed — preferable to scattered `process.env['X']!`
 * assertions that explode at request time.
 *
 * Note: `process.env.NEXT_PUBLIC_*` references are inlined at build time by
 * Next.js *only* when literally referenced. Constructing the object below
 * with literal property reads keeps the inlining intact.
 */

import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL:           z.url(),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL:      process.env['NEXT_PUBLIC_SUPABASE_URL'],
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  NEXT_PUBLIC_API_URL:           process.env['NEXT_PUBLIC_API_URL'],
})
