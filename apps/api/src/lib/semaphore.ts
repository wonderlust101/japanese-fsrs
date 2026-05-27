import { componentLogger } from "./logger.ts";

const log = componentLogger("semaphore");

export interface SemaphoreOptions {
	/** Maximum concurrent slots. */
	max: number;
	/** Tag included in log lines (e.g. 'openai'). */
	label: string;
}

/**
 * Async semaphore with FIFO queue and `AbortSignal`-aware acquire.
 *
 * Used as a bulkhead: caps the number of concurrent operations against
 * a shared resource (e.g. OpenAI API) so a burst of 1000 user requests
 * doesn't queue 1000 in-flight HTTP calls into the event loop. Excess
 * waiters block until a slot frees.
 *
 * Signal awareness: when a waiter's signal aborts, the waiter is removed
 * from the queue and `acquire()` rejects with the abort reason. This
 * prevents memory leaks when clients disconnect (their request handler's
 * `req.signal` aborts; the queued semaphore-waiter cleans up).
 */
export class Semaphore {
	private active = 0;
	private readonly waiters: Array<() => void> = [];

	constructor(private readonly opts: SemaphoreOptions) {}

	/**
	 * Wait for a slot, then return a release function. Caller MUST invoke
	 * release when done — typically via `try/finally` or use `run()` which
	 * handles release for you.
	 */
	async acquire(opts?: { signal?: AbortSignal | undefined }): Promise<() => void> {
		if (this.active < this.opts.max) {
			this.active += 1;
			return () => this.release();
		}

		// Hoist signal + abortHandler into outer scope so the success path
		// (queue resolves normally) can remove the listener afterwards. With
		// `{ once: true }` the listener self-removes on abort, but if the
		// queue resolves first the listener stays attached to the signal —
		// bounded by signal GC in current usage (req.signal), but a hazard
		// if a caller ever passes a long-lived signal.
		const signal = opts?.signal;
		let abortHandler: (() => void) | undefined;

		// Queue full. Wait for a release; honor signal abort.
		await new Promise<void>((resolve, reject) => {
			const cleanup = (): void => {
				const idx = this.waiters.indexOf(resolve);
				if (idx >= 0)
					this.waiters.splice(idx, 1);
			};
			if (signal !== undefined) {
				if (signal.aborted) {
					// Already aborted — never enqueue.
					reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
					return;
				}
				abortHandler = (): void => {
					cleanup();
					reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
				};
				signal.addEventListener("abort", abortHandler, { once: true });
			}
			this.waiters.push(resolve);
		});

		// Slot freed normally — remove the abort listener explicitly so it
		// doesn't accumulate on long-lived signals. No-op when the slot was
		// free immediately (early return above), and irrelevant when the
		// signal aborted (`{ once: true }` self-removed it before reject).
		if (signal !== undefined && abortHandler !== undefined) {
			signal.removeEventListener("abort", abortHandler);
		}

		this.active += 1;
		return () => this.release();
	}

	/**
	 * Acquire, run fn, release — even on throw. Convenience wrapper for the
	 * common case where the caller doesn't need finer-grained control.
	 */
	async run<T>(opts: { signal?: AbortSignal | undefined } | undefined, fn: () => Promise<T>): Promise<T> {
		const release = await this.acquire(opts);
		try {
			return await fn();
		} finally {
			release();
		}
	}

	private release(): void {
		this.active -= 1;
		const next = this.waiters.shift();
		if (next !== undefined) {
			next();
		} else if (this.active < 0) {
			// Defensive: should never happen but log if it does.
			log.warn({ label: this.opts.label, active: this.active }, "semaphore active count went negative");
			this.active = 0;
		}
	}
}
