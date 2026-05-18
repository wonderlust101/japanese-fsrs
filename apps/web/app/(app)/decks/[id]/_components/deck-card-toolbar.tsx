'use client'

import { Pill, PillGroup } from '@/components/ui/Pill'
import { IconSearch } from '@/components/icons/chrome-marks'

export type StatusFilter = 'all' | 'new' | 'learning' | 'review' | 'suspended'

interface Props {
  status:        StatusFilter
  onStatusChange: (next: StatusFilter) => void
  searchValue:   string
  onSearchChange: (next: string) => void
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All'       },
  { value: 'new',       label: 'New'       },
  { value: 'learning',  label: 'Learning'  },
  { value: 'review',    label: 'Review'    },
  { value: 'suspended', label: 'Suspended' },
]

const STATUS_MARK: Record<StatusFilter, string> = {
  all:       '•',
  new:       '+',
  learning:  '◐',
  review:    '↻',
  suspended: '×',
}

/**
 * Mini-toolbar above the card list. Status tabs on the left, search input on
 * the right. Sort and filter affordances are a follow-up — they need API
 * support that doesn't exist yet (see brief).
 *
 * The search input is intentionally labelled to indicate that it filters the
 * currently-loaded card pages, not the full deck. This avoids implying the
 * server can be queried while the list API has no `q` parameter.
 */
export function DeckCardToolbar({
  status,
  onStatusChange,
  searchValue,
  onSearchChange,
}: Props): React.JSX.Element {
  return (
    <section
      aria-label="Card filters"
      className="flex flex-col gap-3 border-b border-soft-hairline pb-4 sm:flex-row sm:items-center sm:gap-4"
    >
      <PillGroup compact>
        {STATUS_TABS.map((tab) => (
          <Pill
            key={tab.value}
            variant="interactive"
            size="lg"
            selected={status === tab.value}
            mark={STATUS_MARK[tab.value]}
            onClick={() => onStatusChange(tab.value)}
            ariaLabel={`Filter cards by ${tab.label}`}
          >
            {tab.label}
          </Pill>
        ))}
      </PillGroup>

      <div className="relative flex-1 sm:max-w-[20rem] sm:ml-auto">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faded-sumi"
        >
          <IconSearch className="h-3.5 w-3.5" />
        </span>
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search this deck"
          aria-label="Search this deck by word, reading, or meaning"
          className={[
            'ui-motion-colors w-full h-9 rounded-[2px] border border-soft-hairline bg-cream-inset pl-8 pr-3 text-sm text-sumi-ink placeholder:text-faded-sumi',
            'hover:border-faded-sumi',
            'focus:outline focus:outline-1 focus:outline-sumi-ink focus:outline-offset-2',
            '[&::-webkit-search-cancel-button]:appearance-none',
            '[&::-webkit-search-decoration]:appearance-none',
          ].join(' ')}
        />
      </div>
    </section>
  )
}
