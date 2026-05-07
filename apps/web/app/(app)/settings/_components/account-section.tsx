'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  changePasswordAction,
  deleteAccountAction,
  signOutEverywhereAction,
} from '@/lib/actions/auth.actions'
import { DeleteAccountDialog } from './delete-account-dialog'

interface Props {
  email:   string
  onSaved: (message: string) => void
  onError: (message: string) => void
}

export function AccountSection({ email, onSaved, onError }: Props): React.JSX.Element {
  const router       = useRouter()
  const queryClient  = useQueryClient()

  const [currentPwd, setCurrentPwd]   = useState('')
  const [pwd1, setPwd1]               = useState('')
  const [pwd2, setPwd2]               = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [signOutEverywhereSubmitting, setSignOutEverywhereSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function changePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (currentPwd.length === 0) {
      onError('Enter your current password to continue')
      return
    }
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
      await changePasswordAction(currentPwd, pwd1)
      onSaved('Password updated')
      setCurrentPwd('')
      setPwd1('')
      setPwd2('')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignOutEverywhere(): Promise<void> {
    setSignOutEverywhereSubmitting(true)
    try {
      await signOutEverywhereAction()
      queryClient.clear()
      router.push('/login')
      router.refresh()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to sign out')
      setSignOutEverywhereSubmitting(false)
    }
  }

  async function handleDelete(currentPassword: string): Promise<void> {
    try {
      await deleteAccountAction(currentPassword)
      queryClient.clear()
      router.push('/')
      router.refresh()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Unknown error')
      // Re-throw so the dialog stays open and the password field can be retried.
      throw e
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
        <Input
          label="Current password"
          type="password"
          value={currentPwd}
          onChange={(e) => setCurrentPwd(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <Input
          label="New password"
          type="password"
          value={pwd1}
          onChange={(e) => setPwd1(e.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
          hint="At least 8 characters"
        />
        <Input
          label="Confirm new password"
          type="password"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <Button type="submit" loading={submitting} disabled={pwd1.length === 0 || currentPwd.length === 0}>
          Update password
        </Button>
      </form>

      <div className="pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleSignOutEverywhere()}
          loading={signOutEverywhereSubmitting}
        >
          Sign out of all devices
        </Button>
        <p className="mt-2 text-xs text-neutral-500">
          Revokes every active session, including this one. You'll be redirected to login.
        </p>
      </div>

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
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
