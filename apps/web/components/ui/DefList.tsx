import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// DefList — editorial label-left / control-right / sub-description-below
// rhythm. Used by Review Setup to avoid the "settings table" or
// "card-grouped panel" anti-patterns. One concept per row.
//
//   ┌─────────────────────────────────────────────┐
//   │ ── SECTION HEADER ──────────────────         │
//   │ Label                              [control] │
//   │ description text spanning width              │
//   │ ── hairline ─────────────────────             │
//   │ Label                              [control] │
//   └─────────────────────────────────────────────┘

interface DefSectionProps {
  title:    string
  hint?:    string
  children: ReactNode
  className?: string
}

export function DefSection({
  title,
  hint,
  children,
  className,
}: DefSectionProps): React.JSX.Element {
  return (
    <section className={cn('py-6 first:pt-0', className)}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
          {title}
        </h2>
        {hint !== undefined && (
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi/70">
            {hint}
          </p>
        )}
      </header>
      <div>{children}</div>
    </section>
  )
}

interface DefRowProps {
  label:        string
  description?: ReactNode
  control:      ReactNode
  /** Optional inline note below the description (e.g. timebox tail behavior). */
  microcopy?:   ReactNode
  /** Indicates the control has deviated from default. Surfaces a soft hairline cue. */
  modified?:    boolean
  htmlFor?:     string
  className?:   string
}

export function DefRow({
  label,
  description,
  control,
  microcopy,
  modified,
  htmlFor,
  className,
}: DefRowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-t border-soft-hairline/70 py-4 first:border-t-0 first:pt-0',
        'sm:grid sm:grid-cols-[1fr_auto] sm:items-start sm:gap-x-6 sm:gap-y-1',
        className,
      )}
    >
      <div className="min-w-0">
        {htmlFor !== undefined ? (
          <label htmlFor={htmlFor} className="block text-[0.9375rem] font-medium text-sumi-ink">
            {label}
            {modified === true && (
              <span
                aria-hidden="true"
                className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-inari-vermillion align-middle"
              />
            )}
          </label>
        ) : (
          <p className="text-[0.9375rem] font-medium text-sumi-ink">
            {label}
            {modified === true && (
              <span
                aria-hidden="true"
                className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-inari-vermillion align-middle"
              />
            )}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-start sm:justify-end sm:row-start-1 sm:col-start-2">
        {control}
      </div>
      {description !== undefined && (
        <p className="text-sm leading-relaxed text-faded-sumi sm:row-start-2 sm:col-start-1 sm:max-w-prose">
          {description}
        </p>
      )}
      {microcopy !== undefined && (
        <p className="text-sm leading-relaxed text-faded-sumi/85 sm:row-start-3 sm:col-start-1 sm:max-w-prose">
          {microcopy}
        </p>
      )}
    </div>
  )
}
