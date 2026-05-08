import { forwardRef } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-inari-vermillion text-warm-paper-raised hover:bg-inari-vermillion-deep focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash disabled:bg-inari-vermillion',
  secondary:
    'bg-warm-paper-raised text-sumi-ink border border-soft-hairline hover:bg-cream-inset focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash disabled:bg-warm-paper-raised',
  ghost:
    'bg-transparent text-faded-sumi hover:bg-cream-inset focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash',
  danger:
    'bg-error text-warm-paper-raised hover:bg-error-deep focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-error-tint disabled:bg-error',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-5 text-md',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] transition-all duration-150',
          'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...rest}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
