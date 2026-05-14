'use client'

import Link from 'next/link'

import { SectionCard } from '@/components/ui/SectionCard'

export type SessionMode = 'mixed' | 'review' | 'new'

const MODE_LABELS: Record<SessionMode, string> = {
  review: 'Review',
  new:    'New',
  mixed:  'Mixed',
}

const MODE_ORDER: SessionMode[] = ['review', 'new', 'mixed']

interface StagingSettingsProps {
  mode:         SessionMode
  onModeChange: (next: SessionMode) => void
  disabled?:    boolean | undefined
}

/**
 * Card 2 in the v2 staging layout. Sits at lg:col-span-4 beside the
 * briefing card. Holds exactly one inline control — the Mode segmented
 * control — and a single quiet outbound link to /settings/learning for
 * permanent defaults. The whole card commits to the "intent over fatigue"
 * editorial choice: the page asks WHAT you want to study, not HOW LONG.
 */
export function StagingSettings({
  mode,
  onModeChange,
  disabled,
}: StagingSettingsProps): React.JSX.Element {
  return (
    <SectionCard
      id="staging-settings"
      kanji="調"
      label="Session settings"
      variant="compact"
      description="Today only. Permanent defaults live in settings."
    >
      <div className="grid gap-5">
        <ModeControl mode={mode} onChange={onModeChange} disabled={disabled} />
      </div>

      <hr aria-hidden="true" className="my-6 border-0 border-t border-soft-hairline/70" />

      <Link
        href="/settings/learning"
        className={[
          'group inline-flex min-h-10 items-center gap-2 rounded-[2px] px-1',
          'text-sm font-medium text-sumi-ink',
          'transition-colors duration-200 ease-out',
          'hover:text-inari-vermillion-deep',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        ].join(' ')}
      >
        Adjust defaults
        <span
          aria-hidden="true"
          className="text-faded-sumi transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-inari-vermillion-deep"
        >
          →
        </span>
      </Link>
      <p className="mt-1.5 text-[0.75rem] text-faded-sumi">
        Daily new limit, retention target, modality.
      </p>
    </SectionCard>
  )
}

function ModeControl({
  mode,
  onChange,
  disabled,
}: {
  mode:      SessionMode
  onChange:  (next: SessionMode) => void
  disabled?: boolean | undefined
}): React.JSX.Element {
  return (
    <div>
      <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-sumi-ink/80">
        Mode
      </p>
      <div
        role="radiogroup"
        aria-label="Session mode"
        className="inline-flex h-10 items-stretch rounded-[2px] border border-soft-hairline bg-cream-inset"
      >
        {MODE_ORDER.map((m) => {
          const selected = m === mode
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(m)}
              disabled={disabled === true}
              className={[
                'inline-flex items-center justify-center px-4 text-sm',
                'transition-colors duration-200 ease-out',
                'first:rounded-l-[2px] last:rounded-r-[2px]',
                '[&:not(:first-child)]:border-l [&:not(:first-child)]:border-soft-hairline',
                selected
                  ? 'bg-vermillion-wash text-inari-vermillion-deep font-medium'
                  : 'text-faded-sumi hover:bg-warm-paper-raised hover:text-sumi-ink',
                'disabled:cursor-not-allowed disabled:opacity-60',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45',
              ].join(' ')}
            >
              {MODE_LABELS[m]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
