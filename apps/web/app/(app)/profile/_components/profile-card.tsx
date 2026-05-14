import Link from 'next/link'

export type ProfileCardTone = 'foreground' | 'middle' | 'back'

interface ProfileCardProps {
  /** If provided, renders as a <Link>; otherwise as an <article>. Foreground
   *  cards (the user's own identity card) should not have href set; sibling
   *  cards (Library, Kanji catalog) should. */
  href?:           string
  tone?:           ProfileCardTone
  /** When href is set, applied to the Link element. Use to set position
   *  (absolute placement, grid cell), padding, and any per-variant tweaks.
   *  The shell tokens (border, background, top stripe, hover) are owned by
   *  this component and cannot be overridden via className. */
  className?:      string
  ariaLabel?:      string
  ariaLabelledBy?: string
  children:        React.ReactNode
}

/**
 * The card shell shared by every Profile direction. Same visual vocabulary
 * as the Settings SectionCard, but without an internal eyebrow row: Profile
 * cards carry their own internal composition (greeting, fact list, link
 * row), and forcing an eyebrow on every variant would constrain layout.
 *
 * Three tones drive the depth ordering for layered or grouped compositions:
 *
 *   foreground - the user's own identity. Full opacity, full vermillion top
 *                stripe, warm-paper-raised background.
 *   middle     - a near-future teaser, e.g. "Kanji catalog" in V1. Reduced
 *                opacity, dimmer top stripe; rises on hover when it's a
 *                Link.
 *   back       - a distant-future teaser, e.g. "Library" in V1. Most
 *                reduced opacity, dimmest top stripe; rises on hover.
 *
 * No default padding: variants set their own to control rhythm. The shell
 * is just the border, background, top stripe, and tone-driven opacity.
 */
export function ProfileCard({
  href,
  tone = 'foreground',
  className,
  ariaLabel,
  ariaLabelledBy,
  children,
}: ProfileCardProps): React.JSX.Element {
  const shell = [
    'block relative rounded-[2px]',
    'border border-soft-hairline border-t-[2px]',
    TONE_CLASSES[tone],
    'transition-opacity duration-200 ease-out',
    href !== undefined ? 'ui-motion-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash' : '',
    className ?? '',
  ].join(' ')

  if (href !== undefined) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={shell}
      >
        {children}
      </Link>
    )
  }

  return (
    <article
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={shell}
    >
      {children}
    </article>
  )
}

/** Per-tone background, top-stripe intensity, and opacity. The hover bump on
 *  middle/back tones is small (15-20%) so it reads as "this is reachable"
 *  rather than as a UI-button hover. */
const TONE_CLASSES: Record<ProfileCardTone, string> = {
  foreground: [
    'bg-warm-paper-raised border-t-inari-vermillion',
    'opacity-100',
  ].join(' '),
  middle: [
    'bg-warm-paper-raised border-t-inari-vermillion/55',
    'opacity-75 hover:opacity-90',
  ].join(' '),
  back: [
    'bg-warm-paper-base border-t-inari-vermillion/30',
    'opacity-55 hover:opacity-75',
  ].join(' '),
}
