/**
 * Inline status hint shown beneath a password input when Caps Lock is on.
 *
 * Renders the caps-lock arrow glyph plus a short label, in the deep brand
 * red so it reads as a warning without escalating to error chrome. Does not
 * own its visibility — parent decides when to render. Conditional render is
 * `{capsLockOn && <CapsLockHint />}` (no longer suppressed when an error is
 * present, since Caps Lock is often the cause of an authentication error).
 *
 * The glyph is intentionally inlined here rather than lifted into the
 * shared icons folder: it has exactly one consumer, and keeping the SVG
 * adjacent makes the hint a single self-contained module.
 */
function CapsLockGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M8 3 L3 8 L5.5 8 L5.5 11.5 L10.5 11.5 L10.5 8 L13 8 Z" />
    </svg>
  )
}

export function CapsLockHint(): React.JSX.Element {
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 text-sm font-medium text-inari-vermillion-deep"
    >
      <CapsLockGlyph />
      <span>Caps Lock is on</span>
    </p>
  )
}
