import OpenAI from "openai";

import { env } from "./env.ts";
import { Semaphore } from "./semaphore.ts";
import { TIMEOUTS } from "./timeouts.ts";

/**
 * Shared OpenAI client used by both the chat-completion service
 * (apps/api/src/services/ai.service.ts) and the embeddings service
 * (apps/api/src/services/card.service.ts). One HTTP client, one connection
 * pool, one timeout setting.
 *
 * Lazy-instantiated only when `OPENAI_API_KEY` is set so non-AI test paths
 * and most local dev runs don't need to set the key. Each service function
 * null-checks `openai` before calling and throws
 * `AppError(500, 'OPENAI_API_KEY not configured', { code: 'OPENAI_KEY_MISSING' })`
 * when absent.
 *
 * `TIMEOUTS.openaiCall` (15s) caps a single HTTP request. The SDK default
 * is 10 minutes, which under degraded OpenAI conditions would tie a request
 * worker up far longer than the 30s server.requestTimeout. 15s ≈ p99
 * latency for chat/embedding calls plus headroom; SDK retries (default 2)
 * cover transient blips. Per-call `AbortSignal` (threaded as `req.signal`
 * through the service functions) further short-circuits billable calls
 * when the client disconnects.
 *
 * The startup probe (lib/startup-probe.ts) keeps its own dedicated OpenAI
 * instance with a tighter `TIMEOUTS.startupProbe` (10s) — intentionally
 * decoupled so a refactor here can't drift probe behavior.
 */
export const openai = env.OPENAI_API_KEY !== undefined
	? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: TIMEOUTS.openaiCall })
	: null;

/**
 * Bulkheading semaphore for OpenAI calls. Caps concurrent in-flight OpenAI
 * HTTP requests per process at 50 — prevents a 1000-user burst from queueing
 * 1000 OpenAI promises into the event loop at once. Excess callers wait;
 * `req.signal` propagation (threaded through `opts.signal` in service
 * functions) cancels the wait when a client disconnects so the queue
 * doesn't leak.
 *
 * 50 is sized for typical OpenAI rate limits (most accounts allow 500+ rpm
 * for chat, well above this floor) — the cap is for event-loop protection
 * not API-quota management. Per-user rate limiters in `middleware/rateLimit.ts`
 * handle quota.
 */
export const openaiSemaphore = new Semaphore({ max: 50, label: "openai" });
