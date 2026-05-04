'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface Props {
  open:      boolean
  email:     string
  onClose:   () => void
  onConfirm: () => void | Promise<void>
}

export function DeleteAccountDialog({ open, email, onClose, onConfirm }: Props): React.JSX.Element {
  const [typed, setTyped]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  async function handle(): Promise<void> {
    if (!matches) return
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
      setTyped('')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Delete account">
      <div className="space-y-4 text-sm">
        <p className="text-neutral-700">
          This permanently deletes your account, profile, all decks, all cards, and your full review history. <strong>This cannot be undone.</strong>
        </p>
        <p className="text-neutral-700">
          To confirm, type your email address (<code className="font-mono text-xs text-neutral-900">{email}</code>) below.
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-neutral-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-danger-100"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!matches}
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
