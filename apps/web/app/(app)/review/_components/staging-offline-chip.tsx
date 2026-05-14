'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useOfflineQueueStatus } from '@/lib/api/reviews'
import { MAX_ATTEMPTS } from '@/lib/offline-queue'

/**
 * Compact inline chip representing the offline queue status. Replaces the
 * full-width v1 `OfflineQueueBanner` inside the v2 staging surface's
 * metadata row. Two visual modes:
 *   - pending  (count > 0, not stuck): a quiet informational chip.
 *   - stuck    (attempts >= MAX_ATTEMPTS): a destructive-tone chip that
 *     opens a Dialog with Retry now / Discard pending actions.
 *
 * When count === 0 the chip renders null so the metadata row collapses
 * the segment cleanly.
 */
export function StagingOfflineChip(): React.JSX.Element | null {
  const { count, stuck, retryNow, discardPending } = useOfflineQueueStatus()
  const [open, setOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  if (count === 0) return null

  const label = `OFFLINE · ${count} waiting`

  if (!stuck) {
    return (
      <span
        role="status"
        className={[
          'inline-flex items-center gap-1.5',
          'font-mono text-[0.625rem] uppercase tracking-[0.12em]',
          'text-faded-sumi',
        ].join(' ')}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-aizome-indigo/55" />
        {label}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'inline-flex items-center gap-1.5 rounded-[2px]',
          'border border-error/30 bg-error-tint/40 px-2 py-0.5',
          'font-mono text-[0.625rem] uppercase tracking-[0.12em] text-error-deep',
          'transition-colors duration-200 ease-out',
          'hover:border-error/50 hover:bg-error-tint/60',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error/45',
        ].join(' ')}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-error" />
        {label}
        <span aria-hidden="true" className="text-error-deep/65">stuck</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Sync paused">
        <p className="mb-3 text-sm text-sumi-ink">
          {count} review{count === 1 ? '' : 's'} failed to sync after {MAX_ATTEMPTS} attempts. Try again, or discard them if you don't need them.
        </p>
        <p className="mb-5 text-xs text-faded-sumi">
          Discarding skips the schedule update for those cards. This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false)
              setConfirmDiscard(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              retryNow()
              setOpen(false)
            }}
          >
            Retry now
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmDiscard(true)}
          >
            Discard pending
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard pending reviews?"
      >
        <p className="mb-5 text-sm text-faded-sumi">
          {count} review{count === 1 ? '' : 's'} will not update the review schedule. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmDiscard(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              discardPending()
              setConfirmDiscard(false)
              setOpen(false)
            }}
          >
            Discard
          </Button>
        </div>
      </Dialog>
    </>
  )
}
