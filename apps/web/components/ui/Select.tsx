'use client'

import { forwardRef, useId } from 'react'

interface SelectOption { value: string; label: string }

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:   string
  options: SelectOption[]
  error?:  string | undefined
  hint?:   string | undefined
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, hint, id: idProp, className = '', ...rest }, ref) => {
    const generatedId  = useId()
    const id           = idProp ?? generatedId
    const errId        = `${id}-error`
    const hintId       = `${id}-hint`
    const describedBy  = [error ? errId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-sumi-ink">{label}</label>
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={[
              'peer w-full h-10 pl-3 pr-8 text-base text-sumi-ink bg-cream-inset border rounded-[var(--radius-md)]',
              'ui-motion-colors appearance-none',
              'focus:outline-none focus:border-inari-vermillion focus:ring-[3px] focus:ring-vermillion-wash',
              error
                ? 'border-error focus:border-error focus:ring-error-tint'
                : 'border-soft-hairline hover:border-faded-sumi',
              className,
            ].join(' ')}
            {...rest}
          >
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg
            className="ui-motion-icon pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faded-sumi peer-hover:text-sumi-ink/75 peer-focus:text-inari-vermillion"
            width="12" height="12" viewBox="0 0 12 12"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </div>
        {hint && !error && <p id={hintId} className="text-xs text-faded-sumi">{hint}</p>}
        {error           && <p id={errId}  role="alert" className="text-xs text-error">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
