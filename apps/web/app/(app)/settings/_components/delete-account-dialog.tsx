'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface Props {
  open:      boolean
  onClose:   () => void
  // Receives the typed current password and is responsible for calling the
  // server action. If onConfirm throws, the dialog stays open and the input
  // is preserved so the user can retry without retyping everything.
  onConfirm: (currentPassword: string) => void | Promise<void>
}

export function DeleteAccountDialog({ open, onClose, onConfirm }: Props): React.JSX.Element {
  const [password, setPassword]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handle(): Promise<void> {
    if (password.length === 0) return
    setSubmitting(true)
    try {
      await onConfirm(password)
      // Success path — dialog closure is the parent's responsibility (it
      // navigates away after deletion). Clear local state defensively.
      setPassword('')
    } catch {
      // Parent surfaces the toast; keep dialog open + password preserved
      // so the user can correct and retry.
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose(): void {
    setPassword('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Delete account">
      <div className="space-y-4 text-sm">
        <p className="text-neutral-700">
          This permanently deletes your account, profile, all decks, all cards, and your full review history. <strong>This cannot be undone.</strong>
        </p>
        <p className="text-neutral-700">
          To confirm, enter your current password.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-neutral-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-danger-100"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={password.length === 0}
            loading={submitting}
            onClick={() => void handle()}
          >
            Delete my account
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
