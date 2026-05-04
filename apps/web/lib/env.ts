/**
 * Validates and exports the web app's environment variables at module load.
 * Importing this module fails fast if any required var is missing — preferable
 * to scattered `process.env['X']!` assertions that explode at request time.
 */

function read(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL:      read('NEXT_PUBLIC_SUPABASE_URL',      process.env['NEXT_PUBLIC_SUPABASE_URL']),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']),
  NEXT_PUBLIC_API_URL:           read('NEXT_PUBLIC_API_URL',           process.env['NEXT_PUBLIC_API_URL']),
} as const
