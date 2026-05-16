import { z } from 'zod'
import { reviewRatingEnum } from '@fsrs-japanese/shared-types'

import { randomUUID } from '@/lib/random-uuid'

const QueuedReviewSchema = z.object({
  cardId:         z.string().uuid(),
  rating:         reviewRatingEnum,
  reviewTimeMs:   z.number().int().nonnegative().optional(),
  queuedAt:       z.number().int().nonnegative(),
  // Stable per-entry idempotency key. Generated on add() and reused across
  // every retry so the server can replay rather than re-process.
  idempotencyKey: z.string().uuid(),
})
const QueueSchema = z.array(QueuedReviewSchema)

type QueuedReview = z.infer<typeof QueuedReviewSchema>

const KEY = 'fsrs_offline_review_queue'
// Held across drains: the batch-level idempotency key the next /reviews/batch
// call should send. Lives in localStorage so a crashed-tab retry uses the
// same key the prior attempt did.
const BATCH_KEY_STORAGE = 'fsrs_offline_review_batch_key'
// Consecutive failed drain attempts on the currently-held batch. Reset on
// confirmBatch (success) or clear (manual discard). When this hits
// MAX_ATTEMPTS the queue is "stuck" — auto-drain refuses to fire and the
// user is shown a Retry-now / Discard-pending banner.
const ATTEMPTS_STORAGE = 'fsrs_offline_review_attempts'

/** Stop auto-retrying after this many consecutive failed drain attempts. */
export const MAX_ATTEMPTS = 5

function readQueue(): QueuedReview[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return []
    const parsed = QueueSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function readPendingBatchKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(BATCH_KEY_STORAGE)
}

function readAttempts(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(ATTEMPTS_STORAGE)
  if (raw === null) return 0
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// In-process pub/sub so React hooks can re-read state without polling. Fires
// whenever any of the three localStorage keys above is touched by one of this
// module's methods. Cross-tab updates land via the browser's `storage` event;
// we additionally dispatch on every same-tab write so the badge re-renders
// immediately after recordFailure / confirmBatch / clear / etc.
const subscribers = new Set<() => void>()
function notify(): void {
  for (const fn of subscribers) fn()
}

export const offlineQueue = {
  add(review: Omit<QueuedReview, 'queuedAt' | 'idempotencyKey'>): void {
    if (typeof window === 'undefined') return
    const queue = readQueue()
    queue.push({
      ...review,
      queuedAt:       Date.now(),
      idempotencyKey: randomUUID(),
    })
    localStorage.setItem(KEY, JSON.stringify(queue))
    notify()
  },

  /**
   * Drain the queue and reserve a batch-level idempotency key. Caller must
   * follow up with `confirmBatch()` on success or `replayBatch(reviews)` on
   * failure. Keeping the batch-key persistent across the drain lets a retry
   * (in the same session or a later one after tab close) reuse the same key
   * so the server replays.
   */
  drainBatch(): { reviews: QueuedReview[]; batchKey: string } {
    const reviews  = readQueue()
    if (reviews.length === 0) return { reviews, batchKey: '' }
    // Reuse a pending batch key if one is held over from a prior failed attempt.
    const batchKey = readPendingBatchKey() ?? randomUUID()
    if (typeof window !== 'undefined') {
      localStorage.setItem(BATCH_KEY_STORAGE, batchKey)
      localStorage.removeItem(KEY)
      notify()
    }
    return { reviews, batchKey }
  },

  /** Mark the current batch as committed — clears the held batch key + attempts. */
  confirmBatch(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(BATCH_KEY_STORAGE)
    localStorage.removeItem(ATTEMPTS_STORAGE)
    notify()
  },

  /**
   * Re-queue a failed batch. Preserves each entry's per-review idempotency
   * key. Leaves the held batch key in place so the next drain reuses it.
   */
  replayBatch(reviews: QueuedReview[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(KEY, JSON.stringify(reviews))
    notify()
  },

  /**
   * Increment the consecutive-failure counter. Call after every failed drain
   * (paired with replayBatch). Returns the new attempt count so the caller
   * can decide whether to surface a stuck-state warning.
   */
  recordFailure(): number {
    if (typeof window === 'undefined') return 0
    const next = readAttempts() + 1
    localStorage.setItem(ATTEMPTS_STORAGE, String(next))
    notify()
    return next
  },

  /** Reset the consecutive-failure counter without changing the queue contents.
   *  Used by "Retry now" so the next mount actually attempts to drain. */
  resetAttempts(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ATTEMPTS_STORAGE)
    notify()
  },

  /** Discard the queue + held batch key + attempts entirely. Used by
   *  "Discard pending" after the user confirms losing the buffered reviews. */
  clear(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(KEY)
    localStorage.removeItem(BATCH_KEY_STORAGE)
    localStorage.removeItem(ATTEMPTS_STORAGE)
    notify()
  },

  size(): number {
    return readQueue().length
  },

  /** Number of consecutive failed drain attempts on the currently-held batch. */
  attempts(): number {
    return readAttempts()
  },

  /** True once auto-drain should stop and surface the Retry/Discard UI. */
  isStuck(): boolean {
    return readAttempts() >= MAX_ATTEMPTS
  },

  /**
   * Subscribe to queue-state changes. Returns the unsubscribe handle. Fires on
   * every same-tab write from this module's methods AND on cross-tab updates
   * via the browser's `storage` event.
   */
  subscribe(listener: () => void): () => void {
    subscribers.add(listener)

    let storageHandler: ((e: StorageEvent) => void) | null = null
    if (typeof window !== 'undefined') {
      storageHandler = (e: StorageEvent): void => {
        if (e.key === KEY || e.key === BATCH_KEY_STORAGE || e.key === ATTEMPTS_STORAGE) {
          listener()
        }
      }
      window.addEventListener('storage', storageHandler)
    }

    return () => {
      subscribers.delete(listener)
      if (storageHandler !== null) {
        window.removeEventListener('storage', storageHandler)
      }
    }
  },
}

export type { QueuedReview }
