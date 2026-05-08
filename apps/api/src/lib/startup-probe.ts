/**
 * Startup-time external-service probes. Run from `index.ts` before
 * `app.listen()` so a misconfigured environment fails to boot rather than
 * silently shipping with degraded behaviour.
 *
 * Failure policy (deliberate split):
 *   - Configuration mismatch (e.g. embedding-model dimension ≠ DB column) is
 *     fatal — refuse to start. The bug is unfixable without ops action.
 *   - Transient external failure (network blip, OpenAI 5xx) is warn-and-
 *     continue. Crashing here would create restart loops during incidents
 *     the rest of the API can survive; the affected code paths surface real
 *     failures at first user write.
 */

import OpenAI from 'openai'

import { env } from './env.ts'
import { componentLogger } from './logger.ts'

const log = componentLogger('startup-probe')

/**
 * The pgvector column `cards.embedding` is declared `vector(1536)`. Switching
 * `OPENAI_EMBEDDING_MODEL` to a model with a different dimension would silently
 * break similar-card search — every embedding write would fail at the DB
 * boundary and the fire-and-forget catch in `card.service.ts` would swallow it.
 * The probe catches the misconfiguration at deploy time instead.
 */
const REQUIRED_EMBEDDING_DIM = 1536

export async function probeOpenAIEmbeddingDimension(): Promise<void> {
  if (env.OPENAI_API_KEY === undefined) {
    log.info('OPENAI_API_KEY not set — skipping embedding-dimension probe')
    return
  }

  // Dedicated short-timeout client just for the probe. Decoupled from the
  // service-layer clients so a future refactor of either side doesn't drift
  // the probe behaviour.
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 10_000 })

  // Narrow try: only the SDK call should be downgraded to warn-and-continue.
  // The post-response logic (data-shape checks, dim read) shouldn't be silently
  // swallowed if it ever throws — that would be a bug, not a transient outage.
  let response: Awaited<ReturnType<typeof client.embeddings.create>>
  try {
    response = await client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: 'probe',
    })
  } catch (err) {
    log.warn(
      {
        err: err instanceof Error
          ? { name: err.name, message: err.message }
          : { detail: String(err) },
      },
      'embedding probe failed (transient OpenAI error); continuing startup',
    )
    return
  }

  const first = response.data[0]
  if (first === undefined) {
    log.warn('embedding probe returned no data; continuing startup')
    return
  }

  const dim = first.embedding.length

  if (dim !== REQUIRED_EMBEDDING_DIM) {
    log.fatal(
      {
        model:    env.OPENAI_EMBEDDING_MODEL,
        actual:   dim,
        expected: REQUIRED_EMBEDDING_DIM,
      },
      'OPENAI_EMBEDDING_MODEL dimension does not match cards.embedding vector(1536); refusing to start',
    )
    process.exit(1)
  }

  log.info(
    { model: env.OPENAI_EMBEDDING_MODEL, dim },
    'embedding-dimension probe passed',
  )
}
