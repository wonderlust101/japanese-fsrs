import { componentLogger } from "./logger.ts";
import { summarizeErr } from "./scrub.ts";

const log = componentLogger("retry");

/**
 * Wrapper error thrown by retry-targeted code to mark a transient HTTP
 * status (502 / 503 / 504) as retry-eligible. `fetch` itself doesn't throw
 * on 5xx — it returns a Response — so callers that want status-aware
 * retries inspect the Response and throw this on transient codes.
 *
 * The original Response is intentionally NOT held on the error: callers
 * should `response.body?.cancel()` BEFORE throwing this (db/supabase.ts
 * does so) to release the agent-pool socket. Holding the Response would
 * imply the body is still readable, which it isn't post-cancel. Status is
 * the only field a retry caller needs.
 */
export class TransientHttpError extends Error {
	constructor(public readonly status: number) {
		super(`Transient HTTP ${status}`);
		this.name = "TransientHttpError";
	}
}

/** True for native fetch network failures (DNS, ECONNRESET, abort, etc.) */
export function isNetworkError(err: unknown): boolean {
	return err instanceof TypeError;
}

/** True when a TransientHttpError carrying a 5xx status is in flight. */
export function isTransientHttp(err: unknown): boolean {
	return err instanceof TransientHttpError;
}

export interface RetryOptions {
	/** Total attempts including the initial one. So 3 = 1 initial + 2 retries. */
	maxAttempts: number;
	/** Base delay (ms) before the first retry. Combined with full jitter. */
	baseMs: number;
	/** Cap on exponential backoff (ms). Subsequent retries don't exceed this. */
	maxMs: number;
	/** Multiplier applied per retry (default 2). */
	factor?: number;
	/** Predicate run on each thrown error — true means retry. */
	isRetryable: (err: unknown) => boolean;
	/** Tag included in every log line (e.g. 'supabase', 'openai'). */
	label: string;
	/**
	 * Optional AbortSignal — when aborted, in-progress backoff sleep rejects
	 *  immediately with the abort reason. The retry loop's catch sees a
	 *  non-retryable abort error and rethrows. Use to short-circuit retries
	 *  on client disconnect.
	 */
	signal?: AbortSignal | undefined;
}

/**
 * Retry helper with full-jitter exponential backoff.
 *
 * `Math.random() * Math.min(baseMs * factor^(attempt-1), maxMs)` — full
 * jitter (random delay between 0 and the exponential ceiling) prevents
 * synchronized retry-storms across many callers hitting the same upstream.
 *
 * Per-attempt logs at `warn` level so retry behavior is visible during
 * incidents without polluting normal-operation logs at `info`. Final-failure
 * lines carry `final: true` so log filters can distinguish retry-exhausted
 * from first-attempt failures.
 */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
	const factor = opts.factor ?? 2;
	let lastErr: unknown;

	for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (attempt === opts.maxAttempts || !opts.isRetryable(err)) {
				log.warn(
					{ label: opts.label, attempt, max: opts.maxAttempts, final: true, err: summarizeErr(err) },
					"retry exhausted",
				);
				throw err;
			}
			const exp = Math.min(opts.baseMs * factor ** (attempt - 1), opts.maxMs);
			const jitteredMs = Math.random() * exp;
			log.warn(
				{ label: opts.label, attempt, max: opts.maxAttempts, nextDelayMs: Math.round(jitteredMs), err: summarizeErr(err) },
				"retrying",
			);
			await sleep(jitteredMs, opts.signal);
		}
	}

	// Unreachable — the loop above either returns or throws.
	throw lastErr;
}

/**
 * Resolves after `ms` milliseconds, OR rejects immediately when `signal`
 * aborts. Cancels the underlying timer on abort so it doesn't fire after
 * rejection (would be a no-op since resolve is unreachable, but cleaner).
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
			return;
		}
		const timer = setTimeout(resolve, ms);
		if (signal !== undefined) {
			signal.addEventListener("abort", () => {
				clearTimeout(timer);
				reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
			}, { once: true });
		}
	});
}
