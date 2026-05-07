import { z } from 'zod'
import { reviewRatingEnum } from '@fsrs-japanese/shared-types'

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

export const offlineQueue = {
  add(review: Omit<QueuedReview, 'queuedAt' | 'idempotencyKey'>): void {
    if (typeof window === 'undefined') return
    const queue = readQueue()
    queue.push({
      ...review,
      queuedAt:       Date.now(),
      idempotencyKey: crypto.randomUUID(),
    })
    localStorage.setItem(KEY, JSON.stringify(queue))
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
    const batchKey = readPendingBatchKey() ?? crypto.randomUUID()
    if (typeof window !== 'undefined') {
      localStorage.setItem(BATCH_KEY_STORAGE, batchKey)
      localStorage.removeItem(KEY)
    }
    return { reviews, batchKey }
  },

  /** Mark the current batch as committed — clears the held batch key. */
  confirmBatch(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(BATCH_KEY_STORAGE)
  },

  /**
   * Re-queue a failed batch. Preserves each entry's per-review idempotency
   * key. Leaves the held batch key in place so the next drain reuses it.
   */
  replayBatch(reviews: QueuedReview[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(KEY, JSON.stringify(reviews))
  },

  size(): number {
    return readQueue().length
  },
}

export type { QueuedReview }
