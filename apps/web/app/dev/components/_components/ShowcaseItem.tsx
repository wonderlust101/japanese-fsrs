interface ShowcaseItemProps {
  label:    string
  caption?: string
  /** Stretch the rendered element to fill the cell width. Useful for wide
   *  components like cards that don't make sense centered in a small column. */
  fill?:    boolean
  children: React.ReactNode
}

/**
 * Labeled cell for the showcase grid. Renders the component above a small
 * caption that documents the prop combination it represents.
 */
export function ShowcaseItem({
  label,
  caption,
  fill = false,
  children,
}: ShowcaseItemProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          'border border-soft-hairline rounded-[2px] bg-warm-paper-raised',
          'p-6 min-h-[88px]',
          fill ? 'flex' : 'flex items-center justify-center',
        ].join(' ')}
      >
        <div className={fill ? 'w-full' : ''}>{children}</div>
      </div>
      <div className="flex flex-col gap-0.5 px-1">
        <span className="text-xs font-medium text-sumi-ink">{label}</span>
        {caption !== undefined && (
          <code className="font-mono text-[11px] text-faded-sumi leading-tight break-words">
            {caption}
          </code>
        )}
      </div>
    </div>
  )
}

interface ShowcaseGridProps {
  /** Min cell width in px. Lower = denser grid. */
  minColumnWidth?: number
  children:        React.ReactNode
}

export function ShowcaseGrid({ minColumnWidth = 220, children }: ShowcaseGridProps): React.JSX.Element {
  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))` }}
    >
      {children}
    </div>
  )
}
