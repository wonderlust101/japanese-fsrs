'use client'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface BulkDeleteDecksDialogProps {
  open:          boolean
  selectedCount: number
  onClose:       () => void
  onConfirm:     () => void
}

export function BulkDeleteDecksDialog({
  open,
  selectedCount,
  onClose,
  onConfirm,
}: BulkDeleteDecksDialogProps): React.JSX.Element {
  const noun = selectedCount === 1 ? 'deck' : 'decks'
  return (
    <Dialog open={open} onClose={onClose} title={`Delete ${selectedCount} ${noun}?`}>
      <p className="mb-5 text-sm text-faded-sumi">
        Their cards and your review history will be deleted. This can&rsquo;t be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Keep {noun}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete {noun}
        </Button>
      </div>
    </Dialog>
  )
}
