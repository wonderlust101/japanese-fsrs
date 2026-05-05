import type { ReviewRating } from '@fsrs-japanese/shared-types'

interface QueuedReview {
  cardId:        string
  rating:        ReviewRating
  reviewTimeMs?: number
  queuedAt:      number
}

const KEY = 'fsrs_offline_review_queue'
const VALID_RATINGS = new Set<ReviewRating>(['again', 'hard', 'good', 'easy'])

/** Runtime shape guard for a single queued review. Discards malformed entries
 *  rather than silently mistyping them after JSON.parse. */
function isQueuedReview(value: unknown): value is QueuedReview {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v['cardId']  !== 'string')  return false
  if (typeof v['queuedAt'] !== 'number') return false
  if (typeof v['rating']  !== 'string' || !VALID_RATINGS.has(v['rating'] as ReviewRating)) return false
  if (v['reviewTimeMs'] !== undefined && typeof v['reviewTimeMs'] !== 'number') return false
  return true
}

function readQueue(): QueuedReview[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isQueuedReview)
  } catch {
    return []
  }
}

export const offlineQueue = {
  add(review: Omit<QueuedReview, 'queuedAt'>): void {
    if (typeof window === 'undefined') return
    const queue = readQueue()
    queue.push({ ...review, queuedAt: Date.now() })
    localStorage.setItem(KEY, JSON.stringify(queue))
  },

  drain(): QueuedReview[] {
    const queue = readQueue()
    if (queue.length > 0) localStorage.removeItem(KEY)
    return queue
  },

  size(): number {
    return readQueue().length
  },
}
