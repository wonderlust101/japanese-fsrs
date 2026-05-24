'use client'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface EndSessionConfirmDialogProps {
  open:      boolean
  /** Cards rated so far this session. Shown in the body so the learner sees
   *  what they're preserving. Omitted from the body when zero. */
  ratedCount: number
  onClose:   () => void
  onConfirm: () => void
}

// Confirm dialog for ending a review session mid-flight. Mirrors the
// SuspendConfirmDialog chrome (sm, ghost Cancel + danger primary, Cancel
// first in tab order). The mobile End-session icon-only button is easy to
// thumb-mistap; this dialog is the friction layer.
//
// The page-level handler skips opening this dialog when the session has no
// rated cards yet — no work to lose, no need for confirmation.
export function EndSessionConfirmDialog({
  open,
  ratedCount,
  onClose,
  onConfirm,
}: EndSessionConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} title="End this session?" size="sm">
      <p className="mb-5 text-sm text-faded-sumi">
        {ratedCount > 0
          ? `${ratedCount} ${ratedCount === 1 ? 'card' : 'cards'} will be saved. The remaining cards stay in your queue for next time.`
          : 'The remaining cards stay in your queue for next time.'}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          End session
        </Button>
      </div>
    </Dialog>
  )
}
