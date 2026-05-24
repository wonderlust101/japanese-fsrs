interface ScrollableChartFrameProps {
  /**
   * Minimum plot width in px. Below this, the chart scrolls horizontally
   * instead of shrinking; at or above it, the inner plot fills the
   * available width. Line/area charts pass a fixed floor (640); the
   * heatmap passes its natural pixel width so cells never drop below a
   * tappable size.
   */
  minWidth: number
  children: React.ReactNode
  /** Appended to the scroll container (e.g. a focus-ring breathing pad). */
  className?: string
}

/**
 * Keeps a fixed-viewBox SVG chart legible on narrow viewports. The chart's
 * own viewBox scales text along with the plot, so on a phone a fixed
 * 1200-unit canvas renders axis labels at ~4px. This frame stops that: the
 * inner plot holds a `min-width`, and the container scrolls horizontally
 * once the viewport drops below it, so labels keep their authored size.
 *
 * The right-edge `mask-image` fade is the same scroll affordance used by
 * the cards/decks paginations and the active-filter rail. It only paints
 * below `sm:` — and since `minWidth` always exceeds a phone viewport and
 * always fits desktop, the fade is visible precisely when scroll is
 * possible. The scrollbar is hidden to match those same rails.
 */
export function ScrollableChartFrame({
  minWidth,
  children,
  className = '',
}: ScrollableChartFrameProps): React.JSX.Element {
  return (
    <div
      className={[
        // py-1 keeps SVG focus rings (outline-offset-2) from clipping
        // against the computed overflow-y when overflow-x is set.
        'overflow-x-auto py-1',
        '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        '[mask-image:linear-gradient(to_right,black_0%,black_calc(100%-2rem),transparent_100%)]',
        'sm:[mask-image:none]',
        className,
      ]
        .filter((c) => c.length > 0)
        .join(' ')}
    >
      <div style={{ minWidth: `${minWidth}px` }}>{children}</div>
    </div>
  )
}
