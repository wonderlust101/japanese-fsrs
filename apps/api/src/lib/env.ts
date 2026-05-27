/**
 * Centralized env-var validation. Parsed once at module load — importing
 * this module fails fast with a Zod error if any required var is missing
 * or malformed, instead of failing later from a random first-touched module.
 *
 * OPENAI_API_KEY is optional at startup; AI services check it at use because
 * non-AI code paths (and most tests) don't need it.
 */

import { z } from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().int().positive().default(3001),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	SUPABASE_URL: z.url(),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
	UPSTASH_REDIS_REST_URL: z.url(),
	UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
	OPENAI_API_KEY: z.string().min(1).optional(),
	OPENAI_CHAT_MODEL: z.string().default("gpt-5.4-nano"),
	OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
	WEAK_SPOT_THRESHOLD: z.coerce.number().int().positive().default(8),
	// Comma-separated list of allowed origins. Tightened so misconfiguration
	// (e.g. `*`, stray commas, non-URL values) fails at startup rather than
	// silently shipping a wrong CORS allow-list. Output is `string[]`; the
	// `cors` package accepts an array directly.
	CORS_ORIGIN: z.string()
		.default("http://localhost:3000")
		.transform(s => s.split(",").map(x => x.trim()).filter(Boolean))
		.pipe(z.array(z.url()).min(1, "CORS_ORIGIN must contain at least one URL")),
	// Optional pino log level. When unset, the logger module defaults to
	// 'debug' in development and 'info' in production / test.
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
});

export const env = envSchema.parse(process.env);
