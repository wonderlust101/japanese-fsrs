'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { TomoSelect } from '@/components/ui/TomoSelect'
import { updateProfileAction }         from '@/lib/actions/profile.actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

import { SectionCard } from '@/components/ui/SectionCard'
import { SETTINGS_INPUT_CLASS, SettingsField } from './settings-field'
import { useFieldFeedback } from './use-field-feedback'

const LANGUAGES = [
  { value: 'en', label: 'English'    },
  { value: 'es', label: 'Spanish'    },
  { value: 'fr', label: 'French'     },
  { value: 'de', label: 'German'     },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese'    },
  { value: 'ko', label: 'Korean'     },
  { value: 'ru', label: 'Russian'    },
  { value: 'ja', label: 'Japanese'   },
] as const

type LanguageValue = (typeof LANGUAGES)[number]['value']

interface Props {
  email:                 string
  initialDisplayName:    string
  initialNativeLanguage: string
  initialTimezone:       string
}

/**
 * Profile section: identity-leaning settings, wrapped in a SectionCard.
 *
 * Two register splits live here per the brief's hybrid-by-sensitivity rule:
 *   Auto-save register:   Native language (TomoSelect; commits on selection).
 *   Explicit-save:        Email, display name, and timezone (commit via the
 *                         section-foot "Save changes" or Enter in any field).
 *
 * Email change uses Supabase's double opt-in: the API call sends a
 * confirmation link to the new address, and the user's effective email
 * doesn't change until they click that link. We surface a persistent
 * "check your inbox" notice under the field after a successful submit so
 * the user doesn't think the change silently failed.
 */
export function ProfileSection({
  email,
  initialDisplayName,
  initialNativeLanguage,
  initialTimezone,
}: Props): React.JSX.Element {
  const feedback = useFieldFeedback()

  const [emailValue,  setEmailValue]  = useState(email)
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [native,      setNative]      = useState<LanguageValue>(
    isLanguageValue(initialNativeLanguage) ? initialNativeLanguage : 'en',
  )
  const [timezone,    setTimezone]    = useState(initialTimezone)

  const [committedEmail,       setCommittedEmail]       = useState(email)
  const [committedDisplayName, setCommittedDisplayName] = useState(initialDisplayName)
  const [committedTimezone,    setCommittedTimezone]    = useState(initialTimezone)

  // Persistent "check your inbox" notice after a successful email submit.
  // Cleared as soon as the user starts editing the field again so a stale
  // notice doesn't linger from a prior submission.
  const [pendingEmailNotice, setPendingEmailNotice] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)

  const emailDirty       = emailValue.trim()  !== committedEmail
  const displayNameDirty = displayName.trim() !== committedDisplayName
  const timezoneDirty    = timezone.trim()    !== committedTimezone
  const formDirty        = emailDirty || displayNameDirty || timezoneDirty

  function handleEmailChange(value: string): void {
    setEmailValue(value)
    // Any keystroke clears a stale "check your inbox" notice from a prior submit.
    if (pendingEmailNotice !== null) setPendingEmailNotice(null)
    if (value.trim() !== committedEmail) feedback.markDirty('email')
    else                                 feedback.clearDirty('email')
  }

  function handleDisplayNameChange(value: string): void {
    setDisplayName(value)
    if (value.trim() !== committedDisplayName) feedback.markDirty('display-name')
    else                                       feedback.clearDirty('display-name')
  }

  function handleTimezoneChange(value: string): void {
    setTimezone(value)
    if (value.trim() !== committedTimezone) feedback.markDirty('timezone')
    else                                    feedback.clearDirty('timezone')
  }

  async function handleNativeChange(value: LanguageValue): Promise<void> {
    const previous = native
    setNative(value)
    if (value === previous) return
    try {
      await updateProfileAction({ nativeLanguage: value })
      feedback.markSaved('native-language')
    } catch (e) {
      setNative(previous)
      feedback.markError('native-language', e instanceof Error ? e.message : 'Could not save.')
    }
  }

  async function submitDirty(): Promise<void> {
    if (!formDirty || submitting) return
    const trimmedEmail = emailValue.trim()
    const trimmedName  = displayName.trim()
    const trimmedTz    = timezone.trim()

    if (displayNameDirty && trimmedName.length === 0) {
      feedback.markError('display-name', 'Display name cannot be empty.')
      return
    }
    if (emailDirty && !isValidEmail(trimmedEmail)) {
      feedback.markError('email', 'Enter a valid email address.')
      return
    }

    setSubmitting(true)

    type CommitOutcome = { id: string; ok: boolean; error?: string }
    const tasks: Promise<CommitOutcome>[] = []

    if (emailDirty) {
      tasks.push((async (): Promise<CommitOutcome> => {
        try {
          const supabase = createSupabaseBrowserClient()
          const { error } = await supabase.auth.updateUser({ email: trimmedEmail })
          if (error !== null) {
            return { id: 'email', ok: false, error: error.message ?? 'Could not save.' }
          }
          return { id: 'email', ok: true }
        } catch (e) {
          return { id: 'email', ok: false, error: e instanceof Error ? e.message : 'Could not save.' }
        }
      })())
    }

    if (displayNameDirty) {
      tasks.push((async (): Promise<CommitOutcome> => {
        try {
          const supabase = createSupabaseBrowserClient()
          const { error } = await supabase.auth.updateUser({ data: { display_name: trimmedName } })
          if (error !== null) {
            return { id: 'display-name', ok: false, error: error.message ?? 'Could not save.' }
          }
          return { id: 'display-name', ok: true }
        } catch (e) {
          return { id: 'display-name', ok: false, error: e instanceof Error ? e.message : 'Could not save.' }
        }
      })())
    }

    if (timezoneDirty && trimmedTz.length > 0) {
      tasks.push((async (): Promise<CommitOutcome> => {
        try {
          await updateProfileAction({ timezone: trimmedTz })
          return { id: 'timezone', ok: true }
        } catch (e) {
          return { id: 'timezone', ok: false, error: e instanceof Error ? e.message : 'Could not save.' }
        }
      })())
    }

    const results = await Promise.all(tasks)

    for (const r of results) {
      if (r.ok) {
        feedback.markSaved(r.id)
        if (r.id === 'email') {
          setCommittedEmail(trimmedEmail)
          setPendingEmailNotice(
            `We sent a confirmation link to ${trimmedEmail}. Click it to finish updating.`,
          )
        }
        if (r.id === 'display-name') setCommittedDisplayName(trimmedName)
        if (r.id === 'timezone')      setCommittedTimezone(trimmedTz)
      } else {
        feedback.markError(r.id, r.error ?? 'Could not save.')
      }
    }

    setSubmitting(false)
  }

  function handleEnterCommit(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submitDirty()
    }
  }

  return (
    <SectionCard
      id="profile"
      kanji="人"
      label="Profile"
      description="How you appear inside Tomo, and the locale your day runs on."
      variant="compact"
    >
      <div className="space-y-5">
        <SettingsField
          label="Email"
          hint={pendingEmailNotice ?? undefined}
          dirty={feedback.isDirty('email')}
          saved={feedback.isSaved('email')}
          error={feedback.getError('email')}
          htmlFor="settings-email"
        >
          <input
            id="settings-email"
            type="email"
            value={emailValue}
            onChange={(e) => handleEmailChange(e.target.value)}
            onKeyDown={handleEnterCommit}
            maxLength={254}
            autoComplete="email"
            className={SETTINGS_INPUT_CLASS}
          />
        </SettingsField>

        <SettingsField
          label="Display name"
          dirty={feedback.isDirty('display-name')}
          saved={feedback.isSaved('display-name')}
          error={feedback.getError('display-name')}
          htmlFor="settings-display-name"
        >
          <input
            id="settings-display-name"
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            onKeyDown={handleEnterCommit}
            maxLength={80}
            autoComplete="name"
            className={SETTINGS_INPUT_CLASS}
          />
        </SettingsField>

        <SettingsField
          label="Native language"
          hint="Used to tune AI explanations and prompts."
          saved={feedback.isSaved('native-language')}
          error={feedback.getError('native-language')}
          htmlFor="settings-native-language"
        >
          <TomoSelect
            id="settings-native-language"
            value={native}
            options={LANGUAGES}
            onValueChange={(v) => void handleNativeChange(v)}
            ariaLabel="Native language"
          />
        </SettingsField>

        <SettingsField
          label="Timezone"
          hint="Used to compute today's queue and forecast windows."
          dirty={feedback.isDirty('timezone')}
          saved={feedback.isSaved('timezone')}
          error={feedback.getError('timezone')}
          htmlFor="settings-timezone"
        >
          <input
            id="settings-timezone"
            type="text"
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            onKeyDown={handleEnterCommit}
            maxLength={100}
            placeholder="e.g. America/New_York"
            autoComplete="off"
            className={SETTINGS_INPUT_CLASS}
          />
        </SettingsField>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 pl-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!formDirty}
          loading={submitting}
          onClick={() => void submitDirty()}
        >
          Save changes
        </Button>
        {formDirty && !submitting && (
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
            Press Enter or click to commit
          </p>
        )}
      </div>
    </SectionCard>
  )
}

function isLanguageValue(v: string): v is LanguageValue {
  return LANGUAGES.some((l) => l.value === v)
}

function isValidEmail(s: string): boolean {
  return /^\S+@\S+\.\S+$/.test(s)
}
