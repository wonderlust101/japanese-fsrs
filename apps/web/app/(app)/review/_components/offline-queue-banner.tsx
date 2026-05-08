'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useOfflineQueueStatus } from '@/lib/api/reviews'
import { MAX_ATTEMPTS } from '@/lib/offline-queue'

/**
 * Banner shown on the /review hub when the offline queue is non-empty.
 * Two visual modes:
 *   • pending: subtle info banner; auto-drain is still active.
 *   • stuck: danger banner; auto-drain has been disabled after MAX_ATTEMPTS
 *            failures. Surfaces Retry-now and Discard-pending actions.
 */
export function OfflineQueueBanner(): React.JSX.Element | null {
  const { count, stuck, retryNow, discardPending } = useOfflineQueueStatus()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (count === 0) return null

  if (!stuck) {
    return (
      <div
        role="status"
        className="w-full rounded-[var(--radius-lg)] border border-soft-hairline bg-warm-paper-base px-4 py-3 text-sm text-sumi-ink"
      >
        🔄 {count} review{count === 1 ? '' : 's'} waiting to sync. Will retry automatically.
      </div>
    )
  }

  return (
    <>
      <div
        role="alert"
        className="w-full rounded-[var(--radius-lg)] border border-error-tint bg-error-tint px-4 py-3 space-y-3"
      >
        <p className="text-sm font-medium text-error">
          ⚠️ {count} review{count === 1 ? '' : 's'} failed to sync after {MAX_ATTEMPTS} attempts.
        </p>
        <p className="text-xs text-error/80">
          Auto-retry is paused. Try again, or discard the pending reviews if you don&apos;t need them.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={retryNow}>
            Retry now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)}>
            Discard pending
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Discard pending reviews?">
        <p className="text-sm text-faded-sumi mb-5">
          {count} review{count === 1 ? '' : 's'} will not be applied to your FSRS schedule. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              discardPending()
              setConfirmOpen(false)
            }}
          >
            Discard
          </Button>
        </div>
      </Dialog>
    </>
  )
}
