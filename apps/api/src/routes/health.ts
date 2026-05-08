import { Router, type RequestHandler } from 'express'

import { rawRedis } from '../db/redis.ts'
import { supabaseAdmin } from '../db/supabase.ts'
import {
  BREAKER_NAMES,
  getBreakerSnapshot,
  isOpen,
  type BreakerName,
  type BreakerSnapshot,
} from '../lib/circuit-breaker.ts'
import { isShuttingDown } from '../lib/shutdown.ts'

const router = Router()

// ─── Dep ping helpers ───────────────────────────────────────────────────────
//
// Each ping does ONE cheap network round-trip and converts any throw
// (including ServiceUnavailableError from the breaker) into the literal
// string 'down' so the endpoint returns its overall status without leaking
// internal exception details.

async function pingSupabase(): Promise<'ok' | 'down'> {
  try {
    // listUsers with the smallest possible page is the cheapest
    // schema-independent reachability check (no project-specific tables).
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
    return error === null ? 'ok' : 'down'
  } catch {
    return 'down'
  }
}

async function pingUpstash(): Promise<'ok' | 'down'> {
  try {
    // Use rawRedis (unwrapped) so a transient Upstash blip surfaces as a
    // network throw rather than a breaker SUE — we want the truth, not the
    // breaker's pessimistic view. The TTL of a non-existent key is -2 in
    // Upstash; the call still succeeds.
    await rawRedis.ttl('circuit:supabase:failures')
    return 'ok'
  } catch {
    return 'down'
  }
}

async function findOpenBreakers(): Promise<BreakerName[]> {
  const checks = await Promise.all(
    BREAKER_NAMES.map(async (name) => ({ name, open: await isOpen(name) })),
  )
  return checks.filter((c) => c.open).map((c) => c.name)
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/_health/live
 *
 * Liveness probe. Always 200 — process up + event loop responsive. No
 * downstream dependency checks. Used by orchestrator liveness probes
 * (Kubernetes / Vercel / Fly) so a slow downstream doesn't trigger a
 * pod-restart loop.
 */
const live: RequestHandler = (_req, res): void => {
  res.json({ ok: true })
}

/**
 * GET /api/v1/_health/ready
 *
 * Readiness probe. Pings Supabase + Upstash and consults the circuit
 * breakers. Returns 200 when all required deps are reachable AND no
 * breaker is open; returns 503 with a structured body otherwise.
 *
 * Used by orchestrator readiness probes / load-balancer traffic shedding —
 * the orchestrator should pull the instance out of rotation when this
 * returns 503, and resume sending traffic once it returns 200 again.
 */
const ready: RequestHandler = async (_req, res): Promise<void> => {
  // Shutdown short-circuits to 503 immediately. The LB needs to stop
  // forwarding traffic the instant we receive SIGTERM, before drain
  // begins — otherwise the first ~5–10s of the orchestrator grace
  // window is wasted serving traffic to a process that's about to exit.
  // Skipping the dep pings on the shutdown path is intentional: deps
  // may already be unreachable from the about-to-exit process if it's
  // being descheduled, and their state doesn't matter for the LB
  // decision once we've decided to drain.
  if (isShuttingDown()) {
    res.status(503).json({
      ok: false,
      shuttingDown: true,
      supabase: 'ok',
      upstash: 'ok',
      breakerOpen: [],
    })
    return
  }

  const [supabase, upstash, openBreakers] = await Promise.all([
    pingSupabase(),
    pingUpstash(),
    findOpenBreakers(),
  ])
  const ok = supabase === 'ok' && upstash === 'ok' && openBreakers.length === 0
  res.status(ok ? 200 : 503).json({
    ok,
    shuttingDown: false,
    supabase,
    upstash,
    breakerOpen: openBreakers,
  })
}

/**
 * GET /api/v1/_health/deep
 *
 * Operational deep-health endpoint. Returns the readiness shape PLUS full
 * per-breaker snapshots (failure counts, TTLs, probe state) across all
 * known namespaces. Useful for ops dashboards.
 *
 * SECURITY NOTE: this endpoint is currently unauthenticated. The breaker
 * snapshot reveals internal failure counters and the active set of
 * dependencies — comparable to information a public status page would show,
 * but exposed without rate-limiting or attribution. If the API is
 * publicly reachable, restrict this endpoint at the deploy config layer
 * (allow-list IPs, dedicated header check, or behind a VPN). Adding an
 * auth gate inline would require carving an exception in the otherwise
 * uniform unauth-then-business pattern, which is opinionated enough to
 * defer to ops.
 */
const deep: RequestHandler = async (_req, res): Promise<void> => {
  const [supabase, upstash, ...snapshots] = await Promise.all([
    pingSupabase(),
    pingUpstash(),
    ...BREAKER_NAMES.map((name) => getBreakerSnapshot(name)),
  ])
  const breakers: Record<BreakerName, BreakerSnapshot> = {} as Record<BreakerName, BreakerSnapshot>
  BREAKER_NAMES.forEach((name, idx) => {
    breakers[name] = snapshots[idx]!
  })
  res.json({
    live: { ok: true },
    ready: { supabase, upstash, shuttingDown: isShuttingDown() },
    breakers,
  })
}

router.get('/live',  live)
router.get('/ready', ready)
router.get('/deep',  deep)

export default router
