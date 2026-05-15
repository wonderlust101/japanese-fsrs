import Link from 'next/link'

type QuietLinkTone = 'brand' | 'error' | 'sumi'
type QuietLinkSize = 'sm' | 'md'

interface QuietLinkBaseProps {
  /** Color register. `brand` = vermillion, `error` = error-deep, `sumi` = faded → sumi-ink. */
  tone?: QuietLinkTone
  /** `sm` keeps the link inline (no min-h). `md` reserves a 44px touch target. */
  size?: QuietLinkSize
  /** Append a trailing `→` glyph that nudges 2px on hover. */
  trailingArrow?: boolean
  /** Accessible label override (use when `children` isn't self-describing). */
  ariaLabel?: string
  className?: string
  children: React.ReactNode
}

interface QuietLinkAsLink extends QuietLinkBaseProps {
  href: string
  onClick?: never
  type?: never
  'aria-expanded'?: never
  'aria-controls'?: never
}

interface QuietLinkAsButton extends QuietLinkBaseProps {
  href?: undefined
  onClick: () => void
  type?: 'button' | 'submit'
  'aria-expanded'?: boolean
  'aria-controls'?: string
}

type QuietLinkProps = QuietLinkAsLink | QuietLinkAsButton

const TONE_CLASSES: Record<QuietLinkTone, string> = {
  brand: 'text-inari-vermillion hover:text-inari-vermillion-deep focus-visible:outline-inari-vermillion/45',
  error: 'text-error-deep hover:text-error focus-visible:outline-error/45',
  sumi:  'text-faded-sumi hover:text-sumi-ink focus-visible:outline-inari-vermillion/45',
}

/**
 * Quiet "marginalia" link — small uppercase mono label, optional trailing
 * arrow that nudges on hover. Used across Today modules (empty-state action,
 * notice retry, week-rhythm "see the next two weeks", glossary toggle, exit
 * links). Renders a Next/Link when given `href`, a button when given
 * `onClick` (the glossary toggle is a button under the same visual rules).
 *
 * The hover/focus ring lives in `today-motion-colors`; the arrow nudge lives
 * in `today-motion-transform`. Both honor `prefers-reduced-motion` via the
 * project's global motion utilities.
 */
export function QuietLink(props: QuietLinkProps): React.JSX.Element {
  const {
    tone = 'sumi',
    size = 'md',
    trailingArrow = false,
    ariaLabel,
    className = '',
    children,
  } = props

  const sizing = size === 'sm'
    ? 'inline-flex items-center px-1 py-1'
    : '-ml-1 inline-flex min-h-9 items-center px-1 py-2 sm:ml-0 sm:min-h-0 sm:px-0 sm:py-0'

  const finalClass = [
    'group',
    sizing,
    'font-mono text-xs uppercase tracking-[0.12em] underline-offset-4 hover:underline',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
    TONE_CLASSES[tone],
    className,
  ].join(' ')

  const inner = (
    <>
      <span>{children}</span>
      {trailingArrow && (
        <span
          aria-hidden="true"
          className="ml-2 today-motion-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      )}
    </>
  )

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        className={finalClass}
        {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
      >
        {inner}
      </Link>
    )
  }

  const buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    type: props.type ?? 'button',
    onClick: props.onClick,
  }
  if (ariaLabel !== undefined) buttonProps['aria-label'] = ariaLabel
  if (props['aria-expanded'] !== undefined) buttonProps['aria-expanded'] = props['aria-expanded']
  if (props['aria-controls'] !== undefined) buttonProps['aria-controls'] = props['aria-controls']

  return (
    <button {...buttonProps} className={finalClass}>
      {inner}
    </button>
  )
}
