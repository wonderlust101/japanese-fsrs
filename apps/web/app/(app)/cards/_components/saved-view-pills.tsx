'use client'

import { BUILTIN_VIEWS, type SavedView } from './saved-views-storage'

export type SavedViewKey = string

interface Props {
  active:   string | null
  onSelect: (next: string | null) => void
  /** Override the view list if a caller wants a different set; defaults to the built-ins. */
  views?:   ReadonlyArray<SavedView>
}

/**
 * Horizontal pill strip of named filter presets. Scrolls horizontally on
 * narrow viewports so the strip never truncates. Clicking the active pill
 * clears the view (returns to default state).
 */
export function SavedViewPills({ active, onSelect, views = BUILTIN_VIEWS }: Props): React.JSX.Element {
  return (
    <nav
      aria-label="Saved views"
      className="-mx-1 overflow-x-auto"
    >
      <div className="flex min-w-max items-center gap-1.5 px-1">
        {views.map((view) => {
          const isActive = view.id === active
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onSelect(isActive ? null : view.id)}
              aria-pressed={isActive}
              title={view.description}
              className={[
                'ui-motion-colors inline-flex h-8 items-center rounded-[2px] border px-3 text-sm',
                'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
                isActive
                  ? 'border-inari-vermillion bg-vermillion-wash font-semibold text-sumi-ink'
                  : 'border-soft-hairline bg-warm-paper-raised text-sumi-ink hover:border-faded-sumi hover:bg-cream-inset',
              ].join(' ')}
            >
              {view.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
