// Use the unprefixed `http` import to match Express's `app.listen()`
// return type. The `node:`-prefixed import resolves to a structurally
// identical but TS-distinct type, which would force every caller to cast.
import type { Server } from "http";
import type { Logger } from "pino";

/**
 * Hard-exit deadline. Sized below the typical 30-second orchestrator grace
 * window so we beat SIGKILL with a clean exit. If drain takes longer than
 * this — likely because long-tail in-flight requests are still completing —
 * exit anyway with code 1 so the orchestrator's force-kill never has to fire.
 */
const SHUTDOWN_GRACE_MS = 25_000;

let shuttingDown = false;

/**
 * True once SIGTERM/SIGINT has fired and gracefulShutdown has begun. The
 * `_health/ready` endpoint consults this so the load balancer flips its
 * traffic-routing decision in lockstep with the API's drain.
 */
export function isShuttingDown(): boolean {
	return shuttingDown;
}

/**
 * Drain in-flight requests and exit cleanly. Idempotent (multiple SIGTERMs
 * are no-ops). Order:
 *   1. Flip `shuttingDown` so `_health/ready` returns 503 immediately.
 *      The LB stops forwarding new traffic at its next probe (~5s).
 *   2. Arm a force-exit timer that hard-exits at SHUTDOWN_GRACE_MS even
 *      if drain hangs. `unref()` so the timer doesn't itself prolong the
 *      event loop after natural drain completes.
 *   3. `server.close()` — new connections refused; existing connections
 *      finish their requests. supabase-js / Upstash / OpenAI are all
 *      HTTP-based with no persistent connections to close.
 *   4. Cancel the force-exit timer; log; exit 0.
 *
 * If anything throws during drain, the existing `unhandledRejection` /
 * `uncaughtException` handlers in `index.ts` still win — they'll exit 1.
 */
export async function gracefulShutdown(
	signal: NodeJS.Signals,
	server: Server,
	log: Logger,
): Promise<void> {
	if (shuttingDown)
		return;
	shuttingDown = true;
	log.info({ signal }, "graceful shutdown initiated");

	const forceExit = setTimeout(() => {
		log.error({ graceMs: SHUTDOWN_GRACE_MS }, "shutdown grace exceeded; hard-exit");
		process.exit(1);
	}, SHUTDOWN_GRACE_MS);
	forceExit.unref();

	await new Promise<void>((resolve, reject) => {
		server.close(err => (err !== undefined ? reject(err) : resolve()));
	});
	log.info("http server closed; in-flight requests drained");

	clearTimeout(forceExit);
	log.info("graceful shutdown complete; exiting");
	process.exit(0);
}
