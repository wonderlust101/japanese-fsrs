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

import { supabaseAdmin } from '../db/supabase.ts'
import { env } from './env.ts'
import { componentLogger } from './logger.ts'
import { TIMEOUTS } from './timeouts.ts'

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
  // service-layer clients (lib/openai.ts) so a future refactor of either
  // side doesn't drift the probe behaviour. Tighter timeout than the
  // request-path client because misconfigurations should fail fast at boot.
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: TIMEOUTS.startupProbe })

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

/**
 * Verifies Supabase is reachable before serving traffic. Supabase is a
 * REQUIRED dependency; if it's unreachable at boot, the API would start and
 * serve 503s for every request after the breaker trips. Failing fast at
 * startup gives ops a clear signal vs. a "running but useless" pod.
 *
 * Uses `auth.admin.listUsers` with the smallest page size — cheap, schema-
 * independent, and exercises both the network path and the service-role key.
 *
 * The Supabase fetch wrapper in db/supabase.ts caps each call at 10s and
 * adds 2 retries with jittered backoff. So the probe takes at most
 * ~25s to fail; outside that window we exit and let the orchestrator
 * decide on restart policy.
 */
export async function probeSupabaseConnectivity(): Promise<void> {
  try {
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error !== null) {
      log.fatal(
        { err: { name: error.name, message: error.message } },
        'Supabase unreachable at startup; refusing to start',
      )
      process.exit(1)
    }
    log.info('Supabase connectivity probe passed')
  } catch (err) {
    log.fatal(
      {
        err: err instanceof Error
          ? { name: err.name, message: err.message }
          : { detail: String(err) },
      },
      'Supabase unreachable at startup; refusing to start',
    )
    process.exit(1)
  }
}
