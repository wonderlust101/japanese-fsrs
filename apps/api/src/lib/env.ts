/**
 * Centralized env-var validation. Parsed once at module load — importing
 * this module fails fast with a Zod error if any required var is missing
 * or malformed, instead of failing later from a random first-touched module.
 *
 * OPENAI_API_KEY is optional at startup; AI services check it at use because
 * non-AI code paths (and most tests) don't need it.
 * SUPABASE_JWT_SECRET is optional because supabase-js validates JWTs against
 * the Supabase project, not against this secret directly.
 */

import { z } from 'zod'

const envSchema = z.object({
  PORT:                       z.coerce.number().int().positive().default(3001),
  NODE_ENV:                   z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL:               z.url(),
  SUPABASE_SERVICE_ROLE_KEY:  z.string().min(1),
  SUPABASE_JWT_SECRET:        z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL:     z.url(),
  UPSTASH_REDIS_REST_TOKEN:   z.string().min(1),
  OPENAI_API_KEY:             z.string().min(1).optional(),
  OPENAI_EMBEDDING_MODEL:     z.string().default('text-embedding-3-small'),
  LEECH_THRESHOLD:            z.coerce.number().int().positive().default(8),
  CORS_ORIGIN:                z.string().default('http://localhost:3000'),
})

export const env = envSchema.parse(process.env)
