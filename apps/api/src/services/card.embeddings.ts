import { createHash } from 'node:crypto'

import { z } from 'zod'

import { redis } from '../db/redis.ts'
import { supabaseAdmin } from '../db/supabase.ts'
import { env }           from '../lib/env.ts'
import { openai, openaiSemaphore } from '../lib/openai.ts'
import { asPayload } from '../lib/db.ts'
import { componentLogger } from '../lib/logger.ts'
import { withBreaker } from '../lib/circuit-breaker.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'

const log = componentLogger('card.embeddings')

// ─── Embedding-by-text-hash cache ─────────────────────────────────────────────
// Same physical text (e.g. premade-deck content reused across users, or a
// common JLPT word created twice) always maps to the same OpenAI embedding.
// Cache the vector in Redis keyed by sha256(text) so repeats skip the
// 200–400ms billable OpenAI call.
//
// Cache key includes the model name AND a version prefix:
//   - Different OPENAI_EMBEDDING_MODEL values produce different vectors —
//     mixing would silently corrupt similarity search.
//   - Version prefix is a manual invalidation lever (bump to invalidate
//     everything under the old key shape without flushing Redis).
//
// Failure-mode: any Redis read failure (network, breaker open) is treated as
// a cache miss; any write failure is logged and dropped. Embedding generation
// never fails because of cache plumbing.
const EMBEDDING_CACHE_TTL     = 60 * 60 * 24 * 30   // 30 days
const EMBEDDING_CACHE_VERSION = 'v1'

// Extracted from card.service.ts so the embedding plumbing (OpenAI calls,
// circuit breaker, pgvector serialization) lives next to the other AI/external-
// system boundaries rather than mixed into the Postgres CRUD layer. The
// Postgres-side card.service.ts re-exports the public surface so call sites
// (cards.controller, scripts/backfill-premade-embeddings.ts) do not change.

/** Breaker namespace for OpenAI embedding calls (separate from the chat
 *  breaker — embedding outages and chat outages are independent). */
const EMBEDDING_BREAKER = 'openai-embeddings'

/** Single user-facing 503 message for the embedding-degradation paths. */
const EMBEDDING_UNAVAILABLE_MSG = 'Embedding service temporarily unavailable; please retry shortly'

// EMBEDDING_MODEL must produce 1536-dim vectors to match the
// `cards.embedding vector(1536)` column type. Switching to a model with a
// different dimension requires a schema migration.
const EMBEDDING_MODEL = env.OPENAI_EMBEDDING_MODEL

const adminLog = componentLogger('admin')

// ─── Slim row schemas (embedding-path only) ───────────────────────────────────

/** Used by regenerateEmbedding: just enough to verify ownership and read the
 *  content needed to build embedding input. */
const CardFieldsRowSchema = z.object({
  id:          z.string(),
  user_id:     z.string().nullable(),
  fields_data: z.record(z.string(), z.unknown()),
})

/** Used by backfillPremadeEmbeddings: premade source rows (user_id IS NULL)
 *  carry no per-user ownership, so the slim shape skips user_id. */
const PremadeEmbedRowSchema = z.object({
  id:          z.string(),
  fields_data: z.record(z.string(), z.unknown()),
})

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Regenerates the embedding for a single card.
 *
 * Loads the card (with ownership check), then delegates to backfillEmbedding.
 * Throws 404 if card not found or not owned by user.
 */
export async function regenerateEmbedding(
  cardId:          string,
  userId:          string,
  expectedDeckId?: string,
  opts?:           { signal?: AbortSignal },
): Promise<void> {
  let fetch = supabaseAdmin
    .from('cards')
    .select('id, user_id, fields_data')
    .eq('id', cardId)
    .eq('user_id', userId)
  if (expectedDeckId !== undefined) fetch = fetch.eq('deck_id', expectedDeckId)

  const { data, error } = await fetch.single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Card not found', { code: 'CARD_NOT_FOUND' })
  }

  // backfillEmbedding wraps the OpenAI call in `withBreaker`, so an open
  // breaker surfaces here as a clean 503 with `Retry-After` — no inline check
  // needed.
  const cardData = CardFieldsRowSchema.parse(data)
  await backfillEmbedding(cardId, userId, cardData.fields_data, opts)
}

/**
 * Builds embedding text from a card's fields_data, computes the embedding via
 * OpenAI, and writes it to the card row with a fresh embedding_updated_at.
 *
 * Used by createCard() (fire-and-forget) and regenerateEmbedding() (synchronous).
 * Throws if OpenAI is misconfigured, the API call fails, or the DB update fails;
 * callers decide whether to surface or swallow these errors.
 *
 * Returns silently (no-op) if the card has no embeddable content — a sentence-
 * layout card with only example sentences, for example, intentionally does not
 * have a word/reading/meaning to embed yet.
 */
export async function backfillEmbedding(
  cardId: string,
  userId: string,
  fieldsData: Record<string, unknown>,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const text = buildEmbeddingText(fieldsData)
  if (text === null) return

  // Cache lookup. Same input text → same vector, so a hit lets us skip the
  // OpenAI round-trip entirely. Any Redis failure (network, breaker open
  // for upstash) is treated as a miss — the embedding path always proceeds.
  const inputHash = createHash('sha256').update(text).digest('hex')
  const cacheKey = `embed:${EMBEDDING_CACHE_VERSION}:${EMBEDDING_MODEL}:${inputHash}`

  const cached = await readEmbeddingCache(cacheKey)

  // Breaker wraps the OpenAI call only — Postgres-side failures bubble as
  // dbError() below and aren't a signal about embedding-service health.
  // Forward `opts.signal` so a client disconnect short-circuits the
  // (billable) embedding call. The post-create fire-and-forget at
  // createCard() deliberately does NOT forward signal — that work is
  // decoupled from the request lifecycle and the semaphore queue blocks
  // until a slot frees (correct for background work).
  const embedding = cached ?? await openaiSemaphore.run({ signal: opts?.signal }, () =>
    withBreaker(
      EMBEDDING_BREAKER,
      EMBEDDING_UNAVAILABLE_MSG,
      () => generateEmbedding(text, opts),
    ),
  )

  // Fire-and-forget cache write on miss. We don't await — a Redis hiccup
  // here mustn't delay the response, and the DB write below is the source
  // of truth for this card's embedding either way.
  if (cached === null) {
    void writeEmbeddingCache(cacheKey, embedding)
  }

  const { error } = await supabaseAdmin
    .from('cards')
    .update({
      // Cast: pgvector(1536) column is generated as `string` by supabase gen
      // types; the supabase-js client serialises a number[] correctly at runtime.
      embedding: embedding as unknown as string,
      embedding_updated_at: new Date().toISOString(),
    })
    .eq('id', cardId)
    .eq('user_id', userId)

  if (error !== null) {
    throw dbError('update card embedding', error)
  }
}

/**
 * Builds the embedding input string from a card's fields_data.
 *
 * Returns a labelled "word: ... | reading: ... | meaning: ..." form so the
 * embedding model can disambiguate fields rather than treating the
 * concatenation as a single bag of tokens. Returns null if no labelled fields
 * are present (e.g. sentence-layout cards before content is filled in).
 */
function buildEmbeddingText(fieldsData: Record<string, unknown>): string | null {
  const word    = typeof fieldsData['word']    === 'string' ? fieldsData['word']    : ''
  const reading = typeof fieldsData['reading'] === 'string' ? fieldsData['reading'] : ''
  const meaning = typeof fieldsData['meaning'] === 'string' ? fieldsData['meaning'] : ''

  const parts: string[] = []
  if (word)    parts.push(`word: ${word}`)
  if (reading) parts.push(`reading: ${reading}`)
  if (meaning) parts.push(`meaning: ${meaning}`)

  return parts.length > 0 ? parts.join(' | ') : null
}

/**
 * Read a cached embedding vector. Returns null on miss, on Redis failure
 * (network, upstash breaker open), or on a corrupt entry (shape drift or
 * wrong dimension). On corrupt entries the bad key is best-effort deleted so
 * subsequent reads fall through to a fresh OpenAI call.
 */
async function readEmbeddingCache(cacheKey: string): Promise<number[] | null> {
  let raw: unknown
  try {
    raw = await redis.get<unknown>(cacheKey)
  } catch (err) {
    log.warn({
      cacheKey,
      err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
    }, 'embedding cache read failed; treating as miss')
    return null
  }
  if (raw === null) return null

  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed) || parsed.length !== 1536 || !parsed.every(n => typeof n === 'number')) {
      throw new Error('cached vector failed shape check')
    }
    return parsed as number[]
  } catch (err) {
    log.warn({
      cacheKey,
      err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
    }, 'corrupt embedding cache entry; treating as miss')
    void redis.del(cacheKey).catch(() => { /* swallow — entry will TTL out */ })
    return null
  }
}

/**
 * Write a freshly generated embedding to the cache. Fire-and-forget: any
 * failure is logged but never propagates — the DB-side `cards.embedding`
 * write below remains the source of truth for the card.
 */
async function writeEmbeddingCache(cacheKey: string, embedding: number[]): Promise<void> {
  try {
    await redis.set(cacheKey, JSON.stringify(embedding), { ex: EMBEDDING_CACHE_TTL })
  } catch (err) {
    log.warn({
      cacheKey,
      err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
    }, 'embedding cache write failed')
  }
}

/**
 * Backfills embeddings for premade source cards (user_id IS NULL,
 * premade_deck_id NOT NULL) that don't have one yet.
 *
 * Iterates serially to respect OpenAI rate limits and to make per-card
 * failures recoverable: a failed card is logged and skipped, and the
 * function continues with the next card. Returns counts so the caller
 * (admin endpoint) can report progress.
 *
 * Idempotent: re-running on already-embedded rows is a no-op since the
 * SELECT filters embedding IS NULL.
 */
export async function backfillPremadeEmbeddings(): Promise<{
  attempted: number
  succeeded: number
  failed:    number
}> {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('id, fields_data')
    .is('user_id', null)
    .not('premade_deck_id', 'is', null)
    .is('embedding', null)

  if (error !== null) {
    throw dbError('list premade cards needing embeddings', error)
  }

  const rows = z.array(PremadeEmbedRowSchema).parse(data ?? [])

  // OpenAI calls stay sequential to respect rate limits; the DB writes are
  // collected and flushed once via bulk_update_card_embeddings.
  const updates: Array<{ id: string; embedding: string }> = []
  let failed = 0

  for (const row of rows) {
    try {
      const text = buildEmbeddingText(row.fields_data)
      if (text === null) {
        failed++
        continue
      }
      const embedding = await generateEmbedding(text)
      // pgvector accepts the literal-array form as TEXT and casts at the SQL
      // boundary inside bulk_update_card_embeddings.
      updates.push({ id: row.id, embedding: `[${embedding.join(',')}]` })
    } catch (err) {
      adminLog.error({ cardId: row.id, err }, 'failed to embed premade card')
      failed++
    }
  }

  let succeeded = 0
  if (updates.length > 0) {
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'bulk_update_card_embeddings',
      asPayload({ p_updates: updates }),
    )
    if (rpcError !== null) {
      adminLog.error({ err: rpcError }, 'bulk embedding update failed')
      failed += updates.length
    } else {
      succeeded = rpcData ?? 0
      // Any update that didn't land (id mismatch, vector parse error, etc.)
      // counts as failed for the caller's diagnostic count.
      failed += updates.length - succeeded
    }
  }

  return { attempted: rows.length, succeeded, failed }
}

/**
 * Generates a 1536-dim embedding via OpenAI text-embedding-3-small.
 * Exported so the admin backfill endpoint can reuse it without round-tripping
 * through the per-card update logic.
 */
export async function generateEmbedding(
  text: string,
  opts?: { signal?: AbortSignal },
): Promise<number[]> {
  if (openai === null) {
    throw new AppError(500, 'OPENAI_API_KEY not configured', { code: 'OPENAI_KEY_MISSING' })
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  }, { signal: opts?.signal })

  const first = response.data?.[0]
  if (first === undefined) {
    throw new AppError(502, 'OpenAI returned no embedding data', { code: 'OPENAI_NO_EMBEDDING_DATA' })
  }

  return first.embedding
}
