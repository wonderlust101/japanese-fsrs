'use client'

export type SavedViewKey =
  | 'weakSpots'
  | 'missing-image'
  | 'missing-audio'
  | 'missing-mnemonic'
  | 'recent'
  | 'suspended'
  | 'due-today'
  | 'n4-verbs'

export interface SavedView {
  key:         SavedViewKey
  label:       string
  description: string
}

export const SAVED_VIEWS: readonly SavedView[] = [
  { key: 'weakSpots',        label: 'Weak spots',       description: 'Cards with repeated lapses or low retention.' },
  { key: 'missing-image',    label: 'Missing images',   description: 'Cards without a picture field.' },
  { key: 'missing-audio',    label: 'Missing audio',    description: 'Cards without expression audio.' },
  { key: 'missing-mnemonic', label: 'Missing mnemonic', description: 'Cards without a memory hook.' },
  { key: 'recent',           label: 'Recently added',   description: 'Newest cards across all decks.' },
  { key: 'suspended',        label: 'Suspended',        description: 'Cards paused from the review queue.' },
  { key: 'due-today',        label: 'Due today',        description: 'Cards scheduled for review today.' },
  { key: 'n4-verbs',         label: 'N4 verbs',         description: 'JLPT N4 cards with verb part of speech.' },
]

interface Props {
  active:   SavedViewKey | null
  onSelect: (next: SavedViewKey | null) => void
}

/**
 * Horizontal pill strip of named filter presets. Scrolls horizontally on
 * narrow viewports so the strip never truncates. Clicking the active pill
 * clears the view (returns to default state).
 */
export function SavedViewPills({ active, onSelect }: Props): React.JSX.Element {
  return (
    <nav
      aria-label="Saved views"
      className="-mx-1 overflow-x-auto"
    >
      <div className="flex min-w-max items-center gap-1.5 px-1">
        {SAVED_VIEWS.map((view) => {
          const isActive = view.key === active
          return (
            <button
              key={view.key}
              type="button"
              onClick={() => onSelect(isActive ? null : view.key)}
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
