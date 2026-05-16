'use client'

import { useMemo, useState } from 'react'

import { SectionCard } from '@/components/ui/SectionCard'
import { DefSection, DefRow } from '@/components/ui/DefList'
import { Segmented } from '@/components/ui/Toggle'
import { Checkbox } from '@/components/ui/Checkbox'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { cn } from '@/lib/utils'

import { SetupDeckList, type DeckRow } from './setup-deck-list'

import type {
  SessionTuning,
  ReviewOrder,
  NewCardOrder,
  TimeboxMinutes,
} from '@/stores/useSessionTuningStore'
import { DEFAULT_TUNING } from '@/stores/useSessionTuningStore'

interface SetupControlsProps {
  tuning:    SessionTuning
  onChange:  <K extends keyof SessionTuning>(key: K, value: SessionTuning[K]) => void
  decks:     ReadonlyArray<DeckRow>
  totalDue:  number
  disabled?: boolean
}

type TabValue = 'basics' | 'decks' | 'advanced'

const SIZE_OPTIONS: ReadonlyArray<number> = [10, 20, 30, 50, 0]
const REVIEW_ORDER_OPTIONS: ReadonlyArray<{ value: ReviewOrder; label: string }> = [
  { value: 'urgency',    label: 'Urgency'    },
  { value: 'shuffle',    label: 'Shuffle'    },
  { value: 'difficulty', label: 'Difficulty' },
]
const NEW_ORDER_OPTIONS: ReadonlyArray<{ value: NewCardOrder; label: string }> = [
  { value: 'deck-order', label: 'Deck order' },
  { value: 'shuffle',    label: 'Shuffle'    },
  { value: 'frequency',  label: 'Frequency'  },
]
const TIMEBOX_OPTIONS: ReadonlyArray<{ value: TimeboxMinutes; label: string }> = [
  { value: null, label: 'Off'    },
  { value: 5,    label: '5 min'  },
  { value: 10,   label: '10 min' },
  { value: 15,   label: '15 min' },
  { value: 20,   label: '20 min' },
  { value: 30,   label: '30 min' },
]

export function SetupControls({
  tuning,
  onChange,
  decks,
  totalDue,
  disabled,
}: SetupControlsProps): React.JSX.Element {
  const [tab, setTab] = useState<TabValue>('basics')

  // Per-tab modified counts. The tab badge is "how many controls in this
  // panel deviate from default," not an absolute count.
  const { basicsModified, decksModified, advancedModified } = useMemo(() => {
    let basics = 0, decks_ = 0, advanced = 0
    if (tuning.sessionSize    !== DEFAULT_TUNING.sessionSize)    basics++
    if (tuning.includeNewCards !== DEFAULT_TUNING.includeNewCards) basics++
    if (tuning.newCardOrder   !== DEFAULT_TUNING.newCardOrder)   basics++
    if (tuning.reviewOrder    !== DEFAULT_TUNING.reviewOrder)    basics++
    if (tuning.overdueFirst   !== DEFAULT_TUNING.overdueFirst)   basics++
    if (tuning.includedDeckIds !== null) decks_++
    if (tuning.timeboxMinutes !== DEFAULT_TUNING.timeboxMinutes) advanced++
    if (tuning.buryRelated    !== DEFAULT_TUNING.buryRelated)    advanced++
    return {
      basicsModified:   basics,
      decksModified:    decks_,
      advancedModified: advanced,
    }
  }, [tuning])

  const allIncluded  = tuning.includedDeckIds === null
  const noneIncluded = tuning.includedDeckIds !== null && tuning.includedDeckIds.length === 0
  const includedCount = allIncluded ? decks.length : (tuning.includedDeckIds?.length ?? 0)

  return (
    <SectionCard
      kanji="調"
      label="Choose settings"
      description="Tabs group the controls. Anything you change here lasts for this session only."
    >
      <fieldset
        disabled={disabled}
        className={cn('min-w-0', disabled === true && 'opacity-60 pointer-events-none')}
      >
        <legend className="sr-only">Session tuning controls</legend>

        <Tabs<TabValue>
          ariaLabel="Session tuning sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'basics',   label: 'Basics',   badge: basicsModified },
            { value: 'decks',    label: 'Decks',    badge: decksModified  },
            { value: 'advanced', label: 'Advanced', badge: advancedModified },
          ]}
        />

        {tab === 'basics' && (
          <TabPanel>
            <BasicsPanel tuning={tuning} onChange={onChange} />
          </TabPanel>
        )}

        {tab === 'decks' && (
          <TabPanel>
            <DecksPanel
              tuning={tuning}
              onChange={onChange}
              decks={decks}
              totalDue={totalDue}
              allIncluded={allIncluded}
              noneIncluded={noneIncluded}
              includedCount={includedCount}
            />
          </TabPanel>
        )}

        {tab === 'advanced' && (
          <TabPanel>
            <AdvancedPanel tuning={tuning} onChange={onChange} />
          </TabPanel>
        )}
      </fieldset>
    </SectionCard>
  )
}

// ── Basics ─────────────────────────────────────────────────────────────────

interface PanelProps {
  tuning:   SessionTuning
  onChange: <K extends keyof SessionTuning>(key: K, value: SessionTuning[K]) => void
}

function BasicsPanel({ tuning, onChange }: PanelProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <DefSection title="Size" className="!py-4 first:!pt-0">
        <DefRow
          label="Session size"
          description="Limit how many cards you'll see this session. Reviews stay in your queue."
          modified={tuning.sessionSize !== DEFAULT_TUNING.sessionSize}
          control={
            <Segmented
              ariaLabel="Session size"
              value={String(tuning.sessionSize)}
              options={SIZE_OPTIONS.map((n) => ({
                value: String(n),
                label: n === 0 ? 'All' : String(n),
              }))}
              onChange={(v) => onChange('sessionSize', Number(v))}
            />
          }
        />
      </DefSection>

      <Divider />

      <DefSection title="New cards" className="!py-4">
        <Checkbox.Row
          checked={tuning.includeNewCards}
          onChange={(next) => onChange('includeNewCards', next)}
          label="Include new cards today"
          description={
            tuning.includeNewCards
              ? 'Fresh cards are added on top of your due reviews.'
              : 'Due reviews are still included.'
          }
        />
        {tuning.includeNewCards && (
          <DefRow
            label="New-card order"
            description="How new cards are sequenced when they appear in the session."
            modified={tuning.newCardOrder !== DEFAULT_TUNING.newCardOrder}
            control={
              <Segmented
                ariaLabel="New-card order"
                value={tuning.newCardOrder}
                options={NEW_ORDER_OPTIONS}
                onChange={(v) => onChange('newCardOrder', v)}
              />
            }
          />
        )}
      </DefSection>

      <Divider />

      <DefSection title="Order" className="!py-4">
        <DefRow
          label="Review order"
          description="The sequence due reviews follow within the session."
          modified={tuning.reviewOrder !== DEFAULT_TUNING.reviewOrder}
          control={
            <Segmented
              ariaLabel="Review order"
              value={tuning.reviewOrder}
              options={REVIEW_ORDER_OPTIONS}
              onChange={(v) => onChange('reviewOrder', v)}
            />
          }
        />
        <Checkbox.Row
          checked={tuning.overdueFirst}
          onChange={(next) => onChange('overdueFirst', next)}
          label="Overdue first"
          description="Focus only on overdue cards. Reviews due today and new cards are deferred."
        />
      </DefSection>
    </div>
  )
}

// ── Decks ──────────────────────────────────────────────────────────────────

interface DecksPanelProps extends PanelProps {
  decks:        ReadonlyArray<DeckRow>
  totalDue:     number
  allIncluded:  boolean
  noneIncluded: boolean
  includedCount: number
}

function DecksPanel({
  tuning,
  onChange,
  decks,
  totalDue,
  allIncluded,
  noneIncluded,
  includedCount,
}: DecksPanelProps): React.JSX.Element {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-faded-sumi tabular-nums">
          Studying {includedCount} of {decks.length} decks, {totalDue} cards total
        </p>
        <div className="flex items-center gap-3">
          <ActionLink
            label="All"
            disabled={allIncluded}
            onClick={() => onChange('includedDeckIds', null)}
          />
          <span aria-hidden="true" className="text-soft-hairline">·</span>
          <ActionLink
            label="None"
            disabled={noneIncluded}
            onClick={() => onChange('includedDeckIds', [])}
          />
        </div>
      </div>

      <SetupDeckList
        decks={decks}
        includedDeckIds={tuning.includedDeckIds}
        onToggle={(deckId, next) => {
          const current: ReadonlyArray<string> =
            tuning.includedDeckIds ?? decks.map((d) => d.id)
          const updated = next
            ? Array.from(new Set([...current, deckId]))
            : current.filter((id) => id !== deckId)
          const isAll = updated.length === decks.length
          onChange('includedDeckIds', isAll ? null : updated)
        }}
      />
    </div>
  )
}

// ── Advanced ───────────────────────────────────────────────────────────────

function AdvancedPanel({ tuning, onChange }: PanelProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <DefRow
        label="Timebox"
        description="Stop accepting new cards once the timer hits zero."
        microcopy={
          tuning.timeboxMinutes === null
            ? undefined
            : <span>When time runs out, you can finish the current card or end the session.</span>
        }
        modified={tuning.timeboxMinutes !== DEFAULT_TUNING.timeboxMinutes}
        control={
          <Segmented
            ariaLabel="Timebox"
            value={tuning.timeboxMinutes === null ? 'off' : String(tuning.timeboxMinutes)}
            options={TIMEBOX_OPTIONS.map((o) => ({
              value: o.value === null ? 'off' : String(o.value),
              label: o.label,
            }))}
            onChange={(v) => {
              if (v === 'off') onChange('timeboxMinutes', null)
              else onChange('timeboxMinutes', Number(v) as TimeboxMinutes)
            }}
          />
        }
      />
      <Checkbox.Row
        checked={tuning.buryRelated}
        onChange={(next) => onChange('buryRelated', next)}
        label="Bury related cards"
        description="If two cards share the same word or kanji, only see one of them today."
      />
    </div>
  )
}

// ── Bits ───────────────────────────────────────────────────────────────────

function Divider(): React.JSX.Element {
  return <div aria-hidden="true" className="h-px w-full bg-soft-hairline/70" />
}

function ActionLink({
  label,
  disabled,
  onClick,
}: {
  label:    string
  disabled: boolean
  onClick:  () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'font-mono text-[0.6875rem] uppercase tracking-[0.14em]',
        'text-faded-sumi hover:text-sumi-ink',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
      )}
    >
      {label}
    </button>
  )
}
