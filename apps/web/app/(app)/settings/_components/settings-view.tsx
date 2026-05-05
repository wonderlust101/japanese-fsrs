'use client'

import { useState } from 'react'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { ProfileSection }  from './profile-section'
import { LearningSection } from './learning-section'
import { AccountSection }  from './account-section'
import type { Profile } from '@fsrs-japanese/shared-types'

interface Props {
  initialProfile: Profile
  email:          string
  displayName:    string
}

interface Toast {
  id:      number
  kind:    'saved' | 'error'
  message: string
}

let toastSeq = 0

export function SettingsView({ initialProfile, email, displayName }: Props): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])

  function addToast(kind: Toast['kind'], message: string): void {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 2200)
  }

  return (
    <>
      <TopBar>
        <h1 className="flex-1 text-base font-semibold text-neutral-900">Settings</h1>
      </TopBar>

      <div className="px-4 lg:px-6 py-6 max-w-[760px] mx-auto">
        {/* In-page anchor nav */}
        <nav aria-label="Settings sections" className="flex gap-3 text-sm text-neutral-500 mb-6 border-b border-neutral-200 pb-3">
          <a href="#profile"  className="hover:text-neutral-900">Profile</a>
          <a href="#learning" className="hover:text-neutral-900">Learning</a>
          <a href="#account"  className="hover:text-neutral-900">Account</a>
        </nav>

        <div className="space-y-10">
          <section id="profile" className="scroll-mt-20">
            <ProfileSection
              initialDisplayName={displayName}
              initialNativeLanguage={initialProfile.nativeLanguage}
              initialTimezone={initialProfile.timezone}
              onSaved={(msg) => addToast('saved', msg)}
              onError={(msg) => addToast('error', msg)}
            />
          </section>

          <section id="learning" className="scroll-mt-20">
            <LearningSection
              initialJlptTarget={initialProfile.jlptTarget}
              initialDailyNew={initialProfile.dailyNewCardsLimit}
              initialDailyReview={initialProfile.dailyReviewLimit}
              initialRetention={initialProfile.retentionTarget}
              initialInterests={initialProfile.interests}
              onSaved={(msg) => addToast('saved', msg)}
              onError={(msg) => addToast('error', msg)}
            />
          </section>

          <section id="account" className="scroll-mt-20">
            <AccountSection
              email={email}
              onSaved={(msg) => addToast('saved', msg)}
              onError={(msg) => addToast('error', msg)}
            />
          </section>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              'px-3 py-2 rounded-[var(--radius-md)] text-sm shadow',
              t.kind === 'saved' ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700',
            ].join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  )
}
