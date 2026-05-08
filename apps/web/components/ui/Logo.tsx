interface LogoProps {
  /** Pixel height of the kitsune mark. Width auto-scales (the SVG is square). */
  size?: number
  /** Show the "TOMO" wordmark to the right of the mark. Default true. */
  showWordmark?: boolean
  /** Wordmark scale: sm for small chrome (mobile top bar), md default, lg for hero/sidebar positions. */
  wordmarkSize?: 'sm' | 'md' | 'lg'
  className?: string
}

// The wordmark is treated as identity typography across every surface: always
// uppercase ("TOMO"), always bold, lightly tracked for refinement at large
// sizes. Size variant only adjusts font-size; weight, case, and tracking stay
// consistent so the brand reads the same in mobile chrome and sidebar.
const wordmarkClass: Record<NonNullable<LogoProps['wordmarkSize']>, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-3xl',
}

export function Logo({
  size = 28,
  showWordmark = true,
  wordmarkSize = 'md',
  className = '',
}: LogoProps): React.JSX.Element {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/brand/logo.svg"
        alt={showWordmark ? '' : 'TOMO'}
        width={size}
        height={size}
        className="shrink-0"
      />
      {showWordmark && (
        <span
          className={`font-bold uppercase tracking-wide text-sumi-ink leading-none ${wordmarkClass[wordmarkSize]}`}
        >
          TOMO
        </span>
      )}
    </span>
  )
}
