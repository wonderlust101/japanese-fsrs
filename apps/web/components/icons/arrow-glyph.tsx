/**
 * Hairline directional arrow used in chrome buttons (Continue, Back, the
 * Begin call-to-action on the welcome cover). Stroke 1.25 keeps it light
 * enough to read as a typographic mark rather than an icon, in line with
 * the design system's "hand-drawn or text-only, never lucide" rule.
 *
 * Single source of truth: both `_components/step-footer.tsx` and the
 * welcome cover at `app/onboarding/page.tsx` import this. Do not inline
 * duplicate copies elsewhere.
 */
export function ArrowGlyph({
  direction,
  className = '',
}: {
  direction:  'left' | 'right'
  className?: string
}): React.JSX.Element {
  if (direction === 'left') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <path
          d="M12 7 H 2 M 6 3 L 2 7 L 6 11"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 7 H 12 M 8 3 L 12 7 L 8 11"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
