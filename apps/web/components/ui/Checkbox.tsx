'use client'

import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface CheckboxProps {
  checked:   boolean
  onChange:  (next: boolean) => void
  ariaLabel?: string
  id?:        string
  disabled?:  boolean
  className?: string
}

// Themed native checkbox. Square with hairline border on warm paper; when
// checked, the box fills vermillion and a paper-white check renders inside.
// No glyph guessing for new learners; the affordance is entirely conventional.
//
// Use Checkbox.Row when you want a full-width clickable row with the label
// on the right; use Checkbox bare when you're composing alongside other
// elements (e.g. in a list-row cell).

function CheckboxRoot({
  checked,
  onChange,
  ariaLabel,
  id,
  disabled,
  className,
}: CheckboxProps): React.JSX.Element {
  return (
    <button
      {...(id !== undefined && { id })}
      type="button"
      role="checkbox"
      aria-checked={checked}
      {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
      disabled={disabled === true}
      onClick={() => { if (disabled !== true) onChange(!checked) }}
      className={cn(
        'group relative inline-flex h-5 w-5 shrink-0 items-center justify-center',
        'rounded-[2px] border transition-colors duration-150 ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        checked
          ? 'border-inari-vermillion bg-inari-vermillion'
          : 'border-soft-hairline bg-warm-paper-raised hover:border-faded-sumi',
        disabled === true && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={cn(
          'h-3.5 w-3.5 transition-opacity duration-150 ease-out',
          checked ? 'opacity-100' : 'opacity-0',
        )}
      >
        <path
          d="M3.5 8.5 L7 12 L13 5"
          fill="none"
          stroke="var(--color-warm-paper-raised, #FAF6F1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

interface CheckboxRowProps {
  checked:   boolean
  onChange:  (next: boolean) => void
  label:     ReactNode
  description?: ReactNode
  disabled?:    boolean
  className?:   string
}

function CheckboxRow({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: CheckboxRowProps): React.JSX.Element {
  const inputId = useId()
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3 py-1',
        disabled === true && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="flex h-6 items-center">
        <CheckboxRoot
          id={inputId}
          checked={checked}
          onChange={onChange}
          {...(disabled !== undefined && { disabled })}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] leading-6 text-sumi-ink">
          {label}
        </span>
        {description !== undefined && (
          <span className="mt-0.5 block text-sm leading-relaxed text-faded-sumi">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

export const Checkbox = Object.assign(CheckboxRoot, { Row: CheckboxRow })
