'use client'

import { useState } from 'react'

import { updateProfileAction } from '@/lib/actions/profile.actions'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
]

interface Props {
  initialDisplayName:    string
  initialNativeLanguage: string
  initialTimezone:       string
  onSaved: (message: string) => void
  onError: (message: string) => void
}

export function ProfileSection({
  initialDisplayName,
  initialNativeLanguage,
  initialTimezone,
  onSaved,
  onError,
}: Props): React.JSX.Element {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [native,      setNative]      = useState(initialNativeLanguage)
  const [timezone,    setTimezone]    = useState(initialTimezone)

  async function commitDisplayName(): Promise<void> {
    if (displayName === initialDisplayName) return
    const trimmed = displayName.trim()
    if (trimmed.length === 0) {
      setDisplayName(initialDisplayName)
      return
    }
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } })
    if (error !== null) onError(error.message ?? 'Failed to update display name')
    else                onSaved('Display name saved')
  }

  async function commitNative(value: string): Promise<void> {
    setNative(value)
    if (value === initialNativeLanguage) return
    try {
      await updateProfileAction({ nativeLanguage: value })
      onSaved('Native language saved')
    } catch (e) {
      setNative(initialNativeLanguage)
      onError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  async function commitTimezone(): Promise<void> {
    if (timezone === initialTimezone) return
    try {
      await updateProfileAction({ timezone })
      onSaved('Timezone saved')
    } catch (e) {
      setTimezone(initialTimezone)
      onError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-sumi-ink">Profile</h2>

      <Field label="Display name">
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={commitDisplayName}
          maxLength={80}
          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-soft-hairline bg-warm-paper-raised text-sm text-sumi-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash"
        />
      </Field>

      <Field label="Native language">
        <select
          value={native}
          onChange={(e) => void commitNative(e.target.value)}
          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-soft-hairline bg-warm-paper-raised text-sm text-sumi-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Timezone" hint="Used to compute streaks and forecast windows.">
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          onBlur={commitTimezone}
          maxLength={100}
          placeholder="e.g. America/New_York"
          className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-soft-hairline bg-warm-paper-raised text-sm text-sumi-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash"
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label:    string
  hint?:    string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-sumi-ink mb-1">{label}</span>
      {children}
      {hint !== undefined && <span className="block mt-1 text-xs text-faded-sumi">{hint}</span>}
    </label>
  )
}
