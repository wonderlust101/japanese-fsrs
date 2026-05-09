interface LogoProps {
  /**
   * Pixel height of the kitsune mark. Width auto-scales (the SVG is square).
   * Brand minimum is 48px; values below that are silently clamped up.
   */
  size?: number
  /** Show the "TOMO" wordmark to the right of the mark. Default true. */
  showWordmark?: boolean
  /** Wordmark scale: sm for tight chrome, md default, lg for sidebar/drawer, xl for hero brand surfaces. */
  wordmarkSize?: 'sm' | 'md' | 'lg' | 'xl'
  /** Color tone:
   *  - 'default': vermillion mark + sumi-ink wordmark (sidebar, drawer, mobile top bar)
   *  - 'inverted': cream mark + warm-paper-raised wordmark (saturated brand fields, e.g. /login). */
  tone?: 'default' | 'inverted'
  className?: string
}

/**
 * Brand minimum: the kitsune mark must never render below 48×48 px. Below
 * that the brushed strokes lose definition and the wordmark loses readable
 * weight against it. Sizes passed below MIN_SIZE are clamped up.
 */
const MIN_SIZE = 48

// The wordmark is treated as identity typography across every surface: always
// uppercase ("TOMO"), always bold, lightly tracked for refinement at large
// sizes. Size variant adjusts font-size only; weight, case, and tracking stay
// consistent so the brand reads the same in mobile chrome and brand-hero.
const wordmarkClass: Record<NonNullable<LogoProps['wordmarkSize']>, string> = {
  sm: 'text-sm',
  md: 'text-md',
  lg: 'text-lg',
  xl: 'text-xl',
}

export function Logo({
  size = MIN_SIZE,
  showWordmark = true,
  wordmarkSize = 'md',
  tone = 'default',
  className = '',
}: LogoProps): React.JSX.Element {
  const resolvedSize  = Math.max(size, MIN_SIZE)
  const src           = tone === 'inverted' ? '/brand/logo-cream.svg' : '/brand/logo.svg'
  const wordmarkColor = tone === 'inverted' ? 'text-warm-paper-raised' : 'text-sumi-ink'

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={src}
        alt={showWordmark ? '' : 'TOMO'}
        width={resolvedSize}
        height={resolvedSize}
        className="shrink-0"
      />
      {showWordmark && (
        <span
          className={`font-bold uppercase tracking-wide leading-none ${wordmarkColor} ${wordmarkClass[wordmarkSize]}`}
        >
          TOMO
        </span>
      )}
    </span>
  )
}
