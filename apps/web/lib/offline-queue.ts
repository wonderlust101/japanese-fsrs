import type { ReviewRating } from '@fsrs-japanese/shared-types'

interface QueuedReview {
  cardId:        string
  rating:        ReviewRating
  reviewTimeMs?: number
  queuedAt:      number
}

const KEY = 'fsrs_offline_review_queue'

function readQueue(): QueuedReview[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QueuedReview[]
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
