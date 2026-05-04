'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { deleteAccountAction } from '@/lib/actions/auth.actions'
import { DeleteAccountDialog } from './delete-account-dialog'

interface Props {
  email:   string
  onSaved: (message: string) => void
  onError: (message: string) => void
}

export function AccountSection({ email, onSaved, onError }: Props): React.JSX.Element {
  const router       = useRouter()
  const queryClient  = useQueryClient()

  const [pwd1, setPwd1]               = useState('')
  const [pwd2, setPwd2]               = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function changePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (pwd1.length < 8) {
      onError('Password must be at least 8 characters')
      return
    }
    if (pwd1 !== pwd2) {
      onError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password: pwd1 })
      if (error !== null) {
        onError(error.message ?? 'Failed to change password')
      } else {
        onSaved('Password updated')
        setPwd1('')
        setPwd2('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await deleteAccountAction()
      queryClient.clear()
      router.push('/')
      router.refresh()
    } catch (e) {
      onError((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-neutral-900">Account</h2>

      <div>
        <span className="block text-sm font-medium text-neutral-700">Email</span>
        <p className="mt-1 text-sm text-neutral-600">{email}</p>
      </div>

      <form onSubmit={changePassword} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">New password</label>
          <input
            type="password"
            value={pwd1}
            onChange={(e) => setPwd1(e.target.value)}
            autoComplete="new-password"
            className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-neutral-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Confirm new password</label>
          <input
            type="password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            autoComplete="new-password"
            className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-neutral-300 bg-white text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-200"
          />
        </div>
        <Button type="submit" loading={submitting} disabled={pwd1.length === 0}>
          Update password
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-danger-100">
        <h3 className="text-sm font-semibold text-danger-700">Danger zone</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Deleting your account permanently removes your decks, cards, and review history. This cannot be undone.
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={() => setConfirmOpen(true)}
        >
          Delete account
        </Button>
      </div>

      <DeleteAccountDialog
        open={confirmOpen}
        email={email}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
