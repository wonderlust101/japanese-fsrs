'use client'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface SuspendConfirmDialogProps {
  open:      boolean
  /** Japanese word/headword of the card being suspended. Shown inline in the
   *  body copy so the user can verify which card is about to leave rotation.
   *  Pass null when unavailable; the dialog falls back to a generic sentence. */
  word:      string | null
  loading:   boolean
  onClose:   () => void
  onConfirm: () => void
}

// Confirm dialog for the in-card Suspend action during a review session.
// Mirrors the bulk-delete-decks chrome (sm size, ghost Cancel + danger
// primary). Cancel takes the focus-on-open slot by virtue of being first in
// the footer tab order; the dialog primitive handles native focus trap.
export function SuspendConfirmDialog({
  open,
  word,
  loading,
  onClose,
  onConfirm,
}: SuspendConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} title="Suspend this card?" size="sm">
      <p className="mb-5 text-sm text-faded-sumi">
        It won&rsquo;t appear in your reviews until you unsuspend it.
        {word !== null && word !== '' && (
          <>
            {' '}
            <span lang="ja" className="font-japanese text-sumi-ink">{word}</span> stays in the deck.
          </>
        )}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Suspend
        </Button>
      </div>
    </Dialog>
  )
}
