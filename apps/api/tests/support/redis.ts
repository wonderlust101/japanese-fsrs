/**
 * In-memory stand-in for `db/redis.ts`. Models the slice of Upstash semantics
 * the app touches — SET (with NX/EX), GET, DEL, INCR, TTL, GETDEL, EVAL — backed
 * by a single Map so the circuit-breaker keys and the cache keys coexist.
 *
 *   const r = createRedisHarness()
 *   mock.module('../../db/redis.ts', () => r.module)
 *   beforeEach(() => r.reset())
 *
 * Exports both `redis` and `rawRedis` (the real module exports both; the
 * circuit breaker imports `rawRedis`), pointing at the same store.
 */

interface SetOptions { ex?: number; nx?: boolean }
interface StoreEntry { value: string | number; ttlSeconds: number }

export interface RedisHarness {
	module: { redis: unknown; rawRedis: unknown };
	/** The backing store — inspect or pre-seed directly in a test if needed. */
	store: Map<string, StoreEntry>;
	reset: () => void;
}

export function createRedisHarness(): RedisHarness {
	const store = new Map<string, StoreEntry>();

	const client = {
		get: async <T>(key: string): Promise<T | null> => {
			const entry = store.get(key);
			return entry === undefined ? null : (entry.value as unknown as T);
		},
		set: async (key: string, value: string | number, opts?: SetOptions): Promise<string | null> => {
			if (opts?.nx === true && store.has(key))
				return null;
			store.set(key, { value, ttlSeconds: opts?.ex ?? -1 });
			return "OK";
		},
		del: async (...keys: readonly string[]): Promise<number> => {
			let removed = 0;
			for (const key of keys) {
				if (store.delete(key))
					removed += 1;
			}
			return removed;
		},
		incr: async (key: string): Promise<number> => {
			const entry = store.get(key);
			const current = entry === undefined
				? 0
				: (typeof entry.value === "number" ? entry.value : Number.parseInt(entry.value, 10) || 0);
			const next = current + 1;
			store.set(key, { value: next, ttlSeconds: entry?.ttlSeconds ?? -1 });
			return next;
		},
		getdel: async <T>(key: string): Promise<T | null> => {
			const entry = store.get(key);
			if (entry === undefined)
				return null;
			store.delete(key);
			return entry.value as unknown as T;
		},
		ttl: async (key: string): Promise<number> => store.get(key)?.ttlSeconds ?? -2,
		eval: async (): Promise<unknown> => null,
	};

	return {
		module: { redis: client, rawRedis: client },
		store,
		reset: () => store.clear(),
	};
}
