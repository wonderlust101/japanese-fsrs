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
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">{label}</label>
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={[
              'w-full h-10 pl-3 pr-8 text-base text-neutral-900 bg-neutral-100 border rounded-[var(--radius-md)]',
              'appearance-none transition-colors duration-150',
              'focus:outline-none focus:border-primary-500 focus:ring-[3px] focus:ring-primary-200',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-100'
                : 'border-neutral-300',
              className,
            ].join(' ')}
            {...rest}
          >
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
            width="12" height="12" viewBox="0 0 12 12"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </div>
        {hint && !error && <p id={hintId} className="text-xs text-neutral-500">{hint}</p>}
        {error           && <p id={errId}  role="alert" className="text-xs text-danger-500">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
