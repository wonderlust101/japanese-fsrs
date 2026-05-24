'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import {
  changePasswordAction,
  deleteAccountAction,
  signOutEverywhereAction,
} from '@/lib/actions/auth.actions'

import { SectionCard } from '@/components/ui/SectionCard'
import { useSettingsSecurityDevState } from '@/dev/panels/settings-security'
import { ContextNote, ContextStrip } from './context-strip'
import { SectionShell } from './section-shell'
import { useFieldFeedback } from './use-field-feedback'

/**
 * Security section: the three sensitive actions split out from Account in V2.
 *
 *   1. Change password
 *   2. Sign out everywhere
 *   3. Delete account (inline re-auth unfold)
 *
 * The card wrapper from SectionCard gives the section its visual identity;
 * internal sub-headings use a smaller register (text-sm font-semibold) so
 * they read as sub-sections within the card, not as new sections.
 */
export function SecuritySection(): React.JSX.Element {
  useSettingsSecurityDevState()
  const router      = useRouter()
  const queryClient = useQueryClient()
  const feedback    = useFieldFeedback()

  // ─── Change password ──────────────────────────────────────────────────────
  const [currentPwd,    setCurrentPwd]    = useState('')
  const [newPwd,        setNewPwd]        = useState('')
  const [confirmPwd,    setConfirmPwd]    = useState('')
  const [pwdSubmitting, setPwdSubmitting] = useState(false)
  // Per-field errors (mirrors the signup form) + a form-level slot for server
  // rejections. Each field's error clears as the user edits that field.
  // Fields are `string | undefined` (not bare optional) so error clearing can
  // assign `undefined` under exactOptionalPropertyTypes.
  const [pwdErrors, setPwdErrors] = useState<{
    currentPwd?: string | undefined
    newPwd?:     string | undefined
    confirmPwd?: string | undefined
    form?:       string | undefined
  }>({})

  async function submitChangePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const fieldErrors: { currentPwd?: string; newPwd?: string; confirmPwd?: string } = {}
    if (currentPwd.length === 0)    fieldErrors.currentPwd = 'Enter your current password to continue.'
    if (newPwd.length < 8)          fieldErrors.newPwd     = 'New password must be at least 8 characters.'
    if (confirmPwd.length === 0)    fieldErrors.confirmPwd = 'Confirm your new password.'
    else if (newPwd !== confirmPwd) fieldErrors.confirmPwd = 'The new password and confirmation do not match.'
    if (Object.keys(fieldErrors).length > 0) { setPwdErrors(fieldErrors); return }

    setPwdErrors({})
    setPwdSubmitting(true)
    try {
      await changePasswordAction(currentPwd, newPwd)
      feedback.markSaved('password')
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch (err) {
      setPwdErrors({ form: err instanceof Error ? err.message : 'Could not change password.' })
    } finally {
      setPwdSubmitting(false)
    }
  }

  // ─── Sign out everywhere ──────────────────────────────────────────────────
  const [signOutSubmitting, setSignOutSubmitting] = useState(false)
  const [signOutError,      setSignOutError]      = useState<string | null>(null)

  async function handleSignOutEverywhere(): Promise<void> {
    setSignOutSubmitting(true)
    setSignOutError(null)
    try {
      await signOutEverywhereAction()
      queryClient.clear()
      router.push('/login')
      router.refresh()
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : 'Could not sign out of all devices.')
      setSignOutSubmitting(false)
    }
  }

  // ─── Delete account (inline re-auth unfold) ───────────────────────────────
  const [deleteUnfolded,   setDeleteUnfolded]   = useState(false)
  const [deletePassword,   setDeletePassword]   = useState('')
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteError,      setDeleteError]      = useState<string | null>(null)

  function openDeleteUnfold(): void {
    setDeleteUnfolded(true)
    setDeleteError(null)
  }
  function closeDeleteUnfold(): void {
    setDeleteUnfolded(false)
    setDeletePassword('')
    setDeleteError(null)
  }

  async function submitDelete(): Promise<void> {
    if (deletePassword.length === 0) return
    setDeleteSubmitting(true)
    setDeleteError(null)
    try {
      await deleteAccountAction(deletePassword)
      queryClient.clear()
      router.push('/')
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete your account.')
      setDeleteSubmitting(false)
    }
  }

  return (
    <SectionShell
      strip={(
        <ContextStrip>
          <ContextNote eyebrow="Password" title="What makes a good one">
            <p>
              At least eight characters, preferably a phrase you can remember. Tomo never
              shows or stores your password in plain text.
            </p>
          </ContextNote>
          <ContextNote eyebrow="Other devices">
            <p>
              Signing out everywhere ends every other session immediately. Useful if you
              suspect another device still has access.
            </p>
          </ContextNote>
          <ContextNote eyebrow="Deletion" title="What gets removed">
            <p>
              Decks, cards, review history, generated sentences and mnemonics, and your
              profile. The action takes effect right away and cannot be undone.
            </p>
          </ContextNote>
        </ContextStrip>
      )}
    >
    <SectionCard
      id="security"
      kanji="鍵"
      label="Security"
      description="How you safeguard your sign-in, and how you walk away."
      variant="compact"
    >
      {/* ─── Change password ─────────────────────────────────────────── */}
      <form onSubmit={submitChangePassword} className="flex flex-col gap-y-4">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-sumi-ink">
          <span>Change password</span>
          <SavedTick visible={feedback.isSaved('password')} label="updated" />
        </h3>

        <div className="flex flex-col gap-y-3 pl-3">
          <Input
            label="Current password"
            type="password"
            value={currentPwd}
            onChange={(e) => {
              setCurrentPwd(e.target.value)
              if (pwdErrors.currentPwd !== undefined) setPwdErrors((p) => ({ ...p, currentPwd: undefined }))
            }}
            autoComplete="current-password"
            placeholder="••••••••"
            error={pwdErrors.currentPwd}
          />
          <Input
            label="New password"
            type="password"
            value={newPwd}
            onChange={(e) => {
              setNewPwd(e.target.value)
              if (pwdErrors.newPwd !== undefined) setPwdErrors((p) => ({ ...p, newPwd: undefined }))
            }}
            autoComplete="new-password"
            placeholder="••••••••"
            hint="At least 8 characters."
            error={pwdErrors.newPwd}
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPwd}
            onChange={(e) => {
              setConfirmPwd(e.target.value)
              if (pwdErrors.confirmPwd !== undefined) setPwdErrors((p) => ({ ...p, confirmPwd: undefined }))
            }}
            autoComplete="new-password"
            placeholder="••••••••"
            error={pwdErrors.confirmPwd}
          />
          {pwdErrors.form !== undefined && (
            <p role="alert" className="text-xs text-error">{pwdErrors.form}</p>
          )}
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={pwdSubmitting}
            disabled={currentPwd.length === 0 || newPwd.length === 0}
          >
            Update password
          </Button>
        </div>
      </form>

      <Divider className="my-6" />

      {/* ─── Sign out everywhere ─────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
        <div>
          <h3 className="text-sm font-semibold text-sumi-ink">Sign out everywhere</h3>
          <p className="mt-1 text-xs text-faded-sumi">
            Revokes every active session, including this one. You'll be redirected to login.
          </p>
          {signOutError !== null && (
            <p role="alert" className="mt-1.5 text-xs text-error">{signOutError}</p>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleSignOutEverywhere()}
          loading={signOutSubmitting}
        >
          Sign out of all devices
        </Button>
      </div>

      <Divider tone="danger" className="my-6" />

      {/* ─── Delete account (inline re-auth unfold) ──────────────────── */}
      <div className="flex flex-col gap-y-4">
        <div>
          <p className="font-mono text-sm text-inari-vermillion-deep/85">
            Danger zone
          </p>
          <h3 className="mt-1.5 text-sm font-semibold text-sumi-ink">Delete account</h3>
          <p className="mt-1 max-w-measure text-xs text-faded-sumi">
            Permanently removes your decks, cards, and review history. This cannot be undone.
          </p>
        </div>

        {!deleteUnfolded ? (
          <Button
            variant="danger"
            size="sm"
            onClick={openDeleteUnfold}
          >
            Delete account
          </Button>
        ) : (
          <div className="rounded-[2px] border border-inari-vermillion/30 bg-vermillion-wash/30 p-4">
            <p className="text-xs text-sumi-ink">
              To confirm, enter your current password. This will sign you out and remove your data immediately.
            </p>
            <div className="mt-3">
              <Input
                label="Current password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            {deleteError !== null && (
              <p role="alert" className="mt-2 text-xs text-error">{deleteError}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={deletePassword.length === 0}
                loading={deleteSubmitting}
                onClick={() => void submitDelete()}
              >
                Delete my account
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeDeleteUnfold}
                disabled={deleteSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
    </SectionShell>
  )
}

function Divider({
  tone = 'default',
  className = '',
}: {
  tone?: 'default' | 'danger'
  className?: string
}): React.JSX.Element {
  return (
    <hr
      aria-hidden="true"
      className={[
        'border-0 border-t',
        tone === 'danger' ? 'border-inari-vermillion/22' : 'border-soft-hairline',
        className,
      ].join(' ')}
    />
  )
}

function SavedTick({
  visible,
  label,
}: {
  visible: boolean
  label:   string
}): React.JSX.Element {
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      aria-hidden={visible ? undefined : true}
      className={[
        'inline-flex items-center gap-1 font-mono text-sm',
        'text-jlpt-n5-fresh-leaf transition-opacity duration-300 ease-out',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <span aria-hidden="true">✓</span>
      <span>{label}</span>
    </span>
  )
}
