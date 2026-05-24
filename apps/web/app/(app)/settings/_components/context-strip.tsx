/**
 * Right-column context strip used by every settings section on desktop.
 *
 * Each section renders one or more `ContextNote` blocks into this strip
 * to surface short, on-topic guidance — keyboard reference for review
 * behaviour, locale resolution for account, sync status for data, etc.
 *
 * The strip itself owns the rhythm and the optional "Preview only"
 * marker that visual-only sections use to stay honest about not yet
 * persisting. Sections never roll their own right column.
 */

interface ContextNoteProps {
  /** Mono small-caps eyebrow above the note body. */
  eyebrow: string
  /** Optional headline below the eyebrow. Falls back to eyebrow if absent. */
  title?: string
  children: React.ReactNode
}

export function ContextNote({
  eyebrow,
  title,
  children,
}: ContextNoteProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-y-2">
      <p className="font-mono text-sm text-faded-sumi">
        {eyebrow}
      </p>
      {title !== undefined && (
        <p className="text-sm font-medium text-sumi-ink">{title}</p>
      )}
      <div className="text-xs leading-relaxed text-faded-sumi flex flex-col gap-y-2">
        {children}
      </div>
    </div>
  )
}

interface ContextStripProps {
  children?: React.ReactNode
}

export function ContextStrip({
  children,
}: ContextStripProps): React.JSX.Element {
  return (
    <aside
      aria-label="Section context"
      className="hidden xl:block w-[300px] shrink-0"
    >
      <div className="sticky top-24 flex flex-col gap-y-6">
        {children}
      </div>
    </aside>
  )
}

// ─── Inline keyboard pill (used in the strip's keyboard references) ──────

export function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="inline-flex items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-1.5 py-0.5 font-mono text-sm text-sumi-ink shadow-[0_1px_0_rgba(31,26,24,0.04)]">
      {children}
    </kbd>
  )
}
