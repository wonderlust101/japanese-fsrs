'use client'

import { forwardRef, useId, useState } from 'react'

type InputSize   = 'sm' | 'md' | 'lg'
type InputScript = 'latin' | 'kana' | 'kanji' | 'mixed'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label:         string
  size?:         InputSize
  error?:        string | undefined
  hint?:         string | undefined
  leadingNode?:  React.ReactNode
  trailingNode?: React.ReactNode
  /**
   * Editorial language tuning. Sets `lang`, `font-family`, and letter-spacing.
   * If `lang` is also passed, the explicit `lang` prop wins for the HTML attribute
   * (accessibility/IME), and `script` still controls font + spacing.
   */
  script?:       InputScript
}

function ErrorGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5 5l6 6M11 5l-6 6" strokeLinecap="round" />
    </svg>
  )
}

function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={visible ? 'Hide password' : 'Show password'}
      className="ui-motion-colors inline-flex items-center text-xs font-medium uppercase tracking-[0.08em] text-faded-sumi hover:text-sumi-ink"
    >
      {visible ? 'Hide' : 'Show'}
    </button>
  )
}

const sizeClasses: Record<InputSize, {
  height:    string
  fontSize:  string
  labelSize: string
}> = {
  sm: { height: 'h-8',  fontSize: 'text-sm',   labelSize: 'text-xs' },
  md: { height: 'h-10', fontSize: 'text-sm',   labelSize: 'text-sm' },
  lg: { height: 'h-12', fontSize: 'text-base', labelSize: 'text-sm' },
}

const sizePaddingLeft: Record<InputSize, string> = {
  sm: 'pl-2.5', md: 'pl-3', lg: 'pl-4',
}
const sizePaddingRight: Record<InputSize, string> = {
  sm: 'pr-2.5', md: 'pr-3', lg: 'pr-4',
}

const scriptConfig: Record<InputScript, { lang: string; fontClass: string; spacingClass: string }> = {
  latin: { lang: 'en', fontClass: '',              spacingClass: '' },
  kana:  { lang: 'ja', fontClass: 'font-japanese', spacingClass: 'tracking-[0.025em]' },
  kanji: { lang: 'ja', fontClass: 'font-japanese', spacingClass: '' },
  mixed: { lang: 'ja', fontClass: 'font-japanese', spacingClass: '' },
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      size         = 'md',
      error,
      hint,
      leadingNode,
      trailingNode,
      script,
      lang:    langProp,
      id:      idProp,
      type,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId()
    const id          = idProp ?? generatedId
    const errorId     = `${id}-error`
    const hintId      = `${id}-hint`
    const [showPassword, setShowPassword] = useState(false)

    const isPassword   = type === 'password'
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

    const describedBy = [error ? errorId : '', hint && !error ? hintId : '']
      .filter(Boolean)
      .join(' ') || undefined

    const scriptCfg    = script !== undefined ? scriptConfig[script] : null
    const resolvedLang = langProp ?? scriptCfg?.lang
    const fontClass    = scriptCfg?.fontClass ?? ''
    const spacingClass = scriptCfg?.spacingClass ?? ''

    const resolvedTrailingNode =
      isPassword && trailingNode === undefined
        ? <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        : trailingNode

    const sizeStyle = sizeClasses[size]
    const inputPL   = leadingNode !== undefined ? 'pl-9' : sizePaddingLeft[size]
    const inputPR   = resolvedTrailingNode !== undefined ? 'pr-9' : sizePaddingRight[size]

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={`${sizeStyle.labelSize} font-medium text-sumi-ink/85`}>
          {label}
        </label>

        <div className="relative">
          {leadingNode !== undefined && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex items-center text-faded-sumi"
              aria-hidden="true"
            >
              {leadingNode}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            type={resolvedType}
            lang={resolvedLang}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={[
              'w-full bg-cream-inset border rounded-[2px]',
              'text-sumi-ink placeholder:text-faded-sumi',
              'ui-motion-colors',
              'focus:outline focus:outline-1 focus:outline-offset-2',
              'disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none',
              'read-only:border-transparent read-only:bg-transparent',
              error
                ? 'border-error focus:border-error focus:outline-error-deep'
                : 'border-soft-hairline hover:border-faded-sumi focus:outline-sumi-ink',
              sizeStyle.height,
              sizeStyle.fontSize,
              fontClass,
              spacingClass,
              inputPL,
              inputPR,
              className,
            ].join(' ')}
            {...rest}
          />

          {resolvedTrailingNode !== undefined && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center">
              {resolvedTrailingNode}
            </span>
          )}
        </div>

        {hint && !error && (
          <p id={hintId} className="text-sm text-faded-sumi">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="flex items-center gap-1.5 text-sm text-error">
            <ErrorGlyph />
            <span>{error}</span>
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
