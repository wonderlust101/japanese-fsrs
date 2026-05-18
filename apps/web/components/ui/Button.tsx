import { forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'editorial' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:      ButtonVariant
  size?:         ButtonSize
  iconOnly?:     boolean
  leadingIcon?:  React.ReactNode
  trailingIcon?: React.ReactNode
  loading?:      boolean
}

function DefaultDangerIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5 5l6 6M11 5l-6 6" strokeLinecap="round" />
    </svg>
  )
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-inari-vermillion text-warm-paper-raised',
    'hover:bg-inari-vermillion-deep',
    'active:bg-inari-vermillion-deep active:shadow-[inset_0_1px_2px_rgba(31,26,24,0.12)]',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
  ].join(' '),
  secondary: [
    'bg-warm-paper-raised text-sumi-ink border border-soft-hairline',
    'hover:bg-cream-inset hover:border-faded-sumi',
    'active:bg-soft-hairline',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
  ].join(' '),
  editorial: [
    'bg-transparent text-sumi-ink border border-soft-hairline',
    'hover:bg-cream-inset hover:border-faded-sumi',
    'active:bg-soft-hairline',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
  ].join(' '),
  ghost: [
    'bg-transparent text-faded-sumi',
    'hover:bg-cream-inset hover:text-sumi-ink',
    'active:bg-soft-hairline',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
  ].join(' '),
  danger: [
    'bg-sumi-ink text-warm-paper-raised',
    'hover:bg-sumi-ink/95',
    'active:bg-sumi-ink/95 active:shadow-[inset_0_1px_2px_rgba(253,251,247,0.10)]',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-warm-paper-raised focus-visible:outline-offset-2',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

const gapClasses: Record<ButtonSize, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant      = 'primary',
      size         = 'md',
      type         = 'button',
      iconOnly     = false,
      leadingIcon,
      trailingIcon,
      loading      = false,
      disabled,
      className    = '',
      children,
      ...rest
    },
    ref,
  ) => {
    if (
      process.env.NODE_ENV === 'development' &&
      variant === 'danger' &&
      leadingIcon === undefined &&
      !iconOnly
    ) {
      console.warn('[Button] variant="danger" should be passed a `leadingIcon` prop. Falling back to default seal-mark glyph.')
    }

    const resolvedLeadingIcon =
      variant === 'danger' && leadingIcon === undefined
        ? <DefaultDangerIcon />
        : leadingIcon

    const sizeStyle = iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading ? true : undefined}
        className={[
          'ui-motion-pressable relative inline-flex items-center justify-center font-medium rounded-[2px]',
          'disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeStyle,
          className,
        ].join(' ')}
        {...rest}
      >
        <span
          className={[
            'ui-motion-soft inline-flex items-center justify-center',
            iconOnly ? '' : gapClasses[size],
            loading ? 'opacity-0' : '',
          ].join(' ')}
        >
          {!iconOnly && resolvedLeadingIcon !== undefined && (
            <span className="ui-motion-icon shrink-0 inline-flex" aria-hidden="true">
              {resolvedLeadingIcon}
            </span>
          )}
          {iconOnly ? (resolvedLeadingIcon ?? children) : children}
          {!iconOnly && trailingIcon !== undefined && (
            <span className="ui-motion-icon shrink-0 inline-flex" aria-hidden="true">
              {trailingIcon}
            </span>
          )}
        </span>
        {loading && (
          <span
            className="ui-motion-soft absolute inset-0 inline-flex items-center justify-center gap-1"
            aria-hidden="true"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-button-dot-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-button-dot-pulse [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-button-dot-pulse [animation-delay:300ms]" />
          </span>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'
