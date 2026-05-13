interface NavSectionProps {
  label:    string
  kanji:    string
  children: React.ReactNode
  /** Icon-rail mode: render kanji only (centered, with hover tooltip + ARIA
   *  heading for the English meaning). The children list still renders below
   *  as icon-only nav rows. */
  collapsed?: boolean
  /** True when this is the first section in the sidebar. */
  isFirst?: boolean
}

/**
 * Section-grouped wrapper for nav items. Expanded mode shows the section's
 * identity kanji at 60% opacity beside the English label in uppercase
 * letterspaced tracking. Collapsed mode (64px rail) shows just the kanji
 * with hover tooltip + ARIA heading announcing the English meaning, so the
 * rail stays readable while preserving the "Japanese is the hero" register.
 */
export function NavSection({
  label,
  kanji,
  children,
  collapsed = false,
  isFirst   = false,
}: NavSectionProps): React.JSX.Element {
  if (collapsed) {
    // Collapsed rail: kanji-only heading (centered) + icon-only rows below.
    // pt-5 pb-2 matches the expanded SectionHeading's vertical metrics so
    // the section header doesn't shift at the collapse swap.
    return (
      <div>
        {!isFirst && <div aria-hidden="true" className="mx-3 mt-3 h-px bg-soft-hairline" />}
        <div
          role="heading"
          aria-level={2}
          aria-label={label}
          title={label}
          className="flex items-center justify-center pt-5 pb-2 select-none cursor-help"
        >
          <span
            lang="ja"
            aria-hidden="true"
            className="font-display text-base leading-none text-inari-vermillion opacity-60"
          >
            {kanji}
          </span>
        </div>
        <ul className="flex flex-col gap-1">
          {children}
        </ul>
      </div>
    )
  }

  return (
    <div className="px-2">
      {!isFirst && <div aria-hidden="true" className="mx-3 mt-3 h-px bg-soft-hairline" />}
      <h2 className="relative flex items-center gap-2 px-3 pt-5 pb-2">
        <span
          lang="ja"
          aria-hidden="true"
          title={label}
          className="font-display text-base leading-none select-none shrink-0 text-inari-vermillion opacity-60"
        >
          {kanji}
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] font-medium text-faded-sumi">
          {label}
        </span>
      </h2>
      <ul className="space-y-1">
        {children}
      </ul>
    </div>
  )
}
