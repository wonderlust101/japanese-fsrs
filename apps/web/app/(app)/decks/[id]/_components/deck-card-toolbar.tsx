'use client'

import { Pill, PillGroup } from '@/components/ui/Pill'
import { SearchInput } from '@/components/ui/SearchInput'

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
 * Mini-toolbar above the card list: status tabs on the left, deck-scoped
 * search on the right. Both drive the backend query — status is a server-side
 * filter and the search box queries the whole deck (word, reading, meaning)
 * through the cross-deck list endpoint, not just the loaded pages. Sort lives
 * one row down in `CardsCountLine`, shared with the Cards browser.
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

      <div className="flex-1 sm:max-w-[20rem] sm:ml-auto">
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search this deck"
          ariaLabel="Search this deck by word, reading, or meaning"
        />
      </div>
    </section>
  )
}
