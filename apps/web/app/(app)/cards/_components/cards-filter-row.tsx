'use client'

import { Pill, PillGroup } from '@/components/ui/Pill'
import { ToolbarChip } from '@/components/ui/ToolbarChip'
import { IconFilter, IconSort } from '@/components/icons/chrome-marks'
import { DecksMenu, MenuItem } from '@/app/(app)/decks/_components/decks-menu'

export type CardsStatus = 'all' | 'new' | 'learning' | 'review' | 'suspended'
export type JlptFilter  = 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond'

export interface CardsFilters {
  deckId: string | 'all'
  jlpt:   JlptFilter
  status: CardsStatus
}

export interface DeckOption {
  id:   string
  name: string
}

interface Props {
  filters:    CardsFilters
  decks:      readonly DeckOption[]
  onChange:   (next: CardsFilters) => void
  onMoreClick: () => void
}

const STATUS_LABEL: Record<CardsStatus, string> = {
  all:       'All',
  new:       'New',
  learning:  'Learning',
  review:    'Review',
  suspended: 'Suspended',
}

const JLPT_LABEL: Record<JlptFilter, string> = {
  all:    'All levels',
  N5:     'N5',
  N4:     'N4',
  N3:     'N3',
  N2:     'N2',
  N1:     'N1',
  beyond: 'Beyond JLPT',
}

const JLPT_ORDER: readonly JlptFilter[] = ['all', 'N5', 'N4', 'N3', 'N2', 'N1', 'beyond']
const STATUS_ORDER: readonly CardsStatus[] = ['all', 'new', 'learning', 'review', 'suspended']

/**
 * Always-visible filter row. Deck + JLPT + Type as dropdowns, Status as a
 * pill group (most-used dimension stays in the open). "More filters"
 * opens a popover with the rest of the IA-specified filters
 * (has audio / image / sentence / nuance / mnemonic / pitch).
 */
export function CardsFilterRow({ filters, decks, onChange, onMoreClick }: Props): React.JSX.Element {
  return (
    <section
      aria-label="Card filters"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-2"
    >
      {/* Deck selector — defaults to "All decks" but lets the user
          scope to one deck for the real wire-up. */}
      <DeckPicker
        decks={decks}
        deckId={filters.deckId}
        onPick={(deckId) => onChange({ ...filters, deckId })}
      />

      <DropdownButton
        icon={<IconSort className="h-3.5 w-3.5 text-faded-sumi" />}
        labelPrefix="JLPT"
        label={JLPT_LABEL[filters.jlpt]}
        items={JLPT_ORDER.map((k) => ({ key: k, label: JLPT_LABEL[k], current: filters.jlpt === k }))}
        onPick={(key) => onChange({ ...filters, jlpt: key as JlptFilter })}
      />

      {/* Status as inline pills — most-used dimension stays in the open. */}
      <PillGroup compact>
        {STATUS_ORDER.map((s) => (
          <Pill
            key={s}
            variant="interactive"
            size="lg"
            selected={filters.status === s}
            onClick={() => onChange({ ...filters, status: s })}
            ariaLabel={`Filter by ${STATUS_LABEL[s]}`}
          >
            {STATUS_LABEL[s]}
          </Pill>
        ))}
      </PillGroup>

      <ToolbarChip
        onClick={onMoreClick}
        leadingNode={<IconFilter className="h-3.5 w-3.5 text-faded-sumi" />}
        className="sm:ml-auto"
      >
        More filters
      </ToolbarChip>
    </section>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function DeckPicker({
  decks,
  deckId,
  onPick,
}: {
  decks:  readonly DeckOption[]
  deckId: string | 'all'
  onPick: (next: string | 'all') => void
}): React.JSX.Element {
  const currentName = deckId === 'all' ? 'All decks' : (decks.find((d) => d.id === deckId)?.name ?? 'Unknown deck')
  return (
    <DecksMenu
      align="start"
      menuClassName="min-w-[14rem]"
      renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
        <ToolbarChip
          ref={triggerRef}
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={ariaExpanded}
          className="max-w-[14rem]"
          trailingNode={<Chevron />}
        >
          <span className="text-faded-sumi">Deck </span>
          <span className="text-sumi-ink">{currentName}</span>
        </ToolbarChip>
      )}
      renderItems={({ close }) => (
        <>
          <MenuItem selected={deckId === 'all'} onClick={() => { onPick('all'); close() }}>
            All decks
          </MenuItem>
          {decks.length > 0 && <div className="my-1 h-px bg-soft-hairline" aria-hidden="true" />}
          {decks.map((d) => (
            <MenuItem key={d.id} selected={d.id === deckId} onClick={() => { onPick(d.id); close() }}>
              {d.name}
            </MenuItem>
          ))}
        </>
      )}
    />
  )
}

function DropdownButton({
  icon,
  labelPrefix,
  label,
  items,
  onPick,
}: {
  icon?:       React.ReactNode
  labelPrefix: string
  label:       string
  items:       readonly { key: string; label: string; current: boolean }[]
  onPick:      (key: string) => void
}): React.JSX.Element {
  return (
    <DecksMenu
      align="start"
      menuClassName="min-w-[10rem]"
      renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
        <ToolbarChip
          ref={triggerRef}
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={ariaExpanded}
          leadingNode={icon}
          trailingNode={<Chevron />}
        >
          <span className="text-faded-sumi">{labelPrefix} </span>
          <span className="text-sumi-ink">{label}</span>
        </ToolbarChip>
      )}
      renderItems={({ close }) => (
        <>
          {items.map((it) => (
            <MenuItem key={it.key} selected={it.current} onClick={() => { onPick(it.key); close() }}>
              {it.label}
            </MenuItem>
          ))}
        </>
      )}
    />
  )
}

function Chevron(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-faded-sumi"
    >
      <path d="M2 4l3 3 3-3" />
    </svg>
  )
}
