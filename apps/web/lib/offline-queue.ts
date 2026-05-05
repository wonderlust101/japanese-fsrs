import { z } from 'zod'
import { reviewRatingEnum } from '@fsrs-japanese/shared-types'

const QueuedReviewSchema = z.object({
  cardId:       z.string().uuid(),
  rating:       reviewRatingEnum,
  reviewTimeMs: z.number().int().nonnegative().optional(),
  queuedAt:     z.number().int().nonnegative(),
})
const QueueSchema = z.array(QueuedReviewSchema)

type QueuedReview = z.infer<typeof QueuedReviewSchema>

const KEY = 'fsrs_offline_review_queue'

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
