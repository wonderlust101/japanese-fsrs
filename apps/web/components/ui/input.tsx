'use client'

import { forwardRef, useId, useState } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | undefined
  hint?: string | undefined
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id: idProp, type, className = '', ...rest }, ref) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const errorId = `${id}-error`
    const hintId = `${id}-hint`
    const [showPassword, setShowPassword] = useState(false)

    const isPassword = type === 'password'
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

    const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">
          {label}
        </label>

        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={resolvedType}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={[
              'w-full h-10 px-3 text-base text-neutral-900 bg-neutral-100 border rounded-[var(--radius-md)]',
              'placeholder:text-neutral-400 transition-colors duration-150',
              'focus:outline-none focus:border-primary-500 focus:ring-[3px] focus:ring-primary-200',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-100'
                : 'border-neutral-300',
              isPassword ? 'pr-10' : '',
              className,
            ].join(' ')}
            {...rest}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}
        </div>

        {hint && !error && (
          <p id={hintId} className="text-xs text-neutral-500">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger-500">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
