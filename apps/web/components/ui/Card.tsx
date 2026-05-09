import { forwardRef } from 'react'

type CardVariant = 'default' | 'compact' | 'surface'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  /** Optional override of the top-stripe color (default Inari Vermillion). */
  stripeColor?: string
  /** Hide the top-stripe entirely (e.g., for nested surface cards inside a parent card). */
  noStripe?: boolean
}

/**
 * The Card primitive. The visual hero of the SRS-tool register.
 *
 * Anatomy:
 *   - 1px Soft Hairline border around all edges
 *   - 2px sharp corners (rounded-[2px])
 *   - 2px Inari Vermillion top-edge stripe (the identity device)
 *   - Warm Paper Raised background (so the card reads as "warmer than the cool
 *     page beneath it")
 *   - No drop shadow. Depth comes from cards stacked behind, not from blur.
 *
 * Variants:
 *   - default: full-size card with generous internal padding (auth, onboarding)
 *   - compact: tighter padding for smaller cards (signup form section)
 *   - surface: nested surface inside a parent card (no stripe, lighter border)
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', stripeColor, noStripe = false, className = '', children, ...rest }, ref) => {
    const padding =
      variant === 'compact' ? 'p-6' :
      variant === 'surface' ? 'p-5' :
      'p-8 md:p-10'

    const isSurface = variant === 'surface'

    // The 2px Inari Vermillion top stripe REPLACES the top border on default
    // and compact variants, so the stripe sits flush with the top edge of
    // the card rather than 1px below the (otherwise-rendered) top border.
    // Surface variant has no stripe so it gets a normal full border.
    const showStripe = !noStripe && !isSurface
    const borderClass = isSurface
      ? 'border border-soft-hairline/60'
      : showStripe
        ? 'border-l border-r border-b border-soft-hairline'
        : 'border border-soft-hairline'

    return (
      <div
        ref={ref}
        className={[
          'relative rounded-[2px] overflow-hidden',
          isSurface ? 'bg-cream-inset' : 'bg-warm-paper-raised',
          borderClass,
          padding,
          className,
        ].join(' ')}
        {...rest}
      >
        {showStripe && (
          <span
            aria-hidden="true"
            // Negative offsets push the stripe past the padding edge so it
            // reaches the card's actual visual edges. overflow-hidden on the
            // root clips the stripe to the rounded-2px corners.
            className="absolute top-0 -left-px -right-px h-[2px]"
            style={{ backgroundColor: stripeColor ?? 'var(--color-inari-vermillion)' }}
          />
        )}
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'
