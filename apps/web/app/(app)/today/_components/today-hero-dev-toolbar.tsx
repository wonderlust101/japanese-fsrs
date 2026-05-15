'use client'

import type { HeroKind } from './today-hero'

export type HeroQueuePreset = 'one' | 'no-backlog' | 'typical' | 'backlog-heavy' | 'large'
export type HeroDeckPreset = 'none' | 'one' | 'two' | 'three' | 'more'
export type HeroRouteMixPreset = 'balanced' | 'new-heavy' | 'review-heavy'
export type HeroFlagPreset = 'none' | 'stale-data'

export interface HeroDevControls {
  variant:  HeroKind
  queue:    HeroQueuePreset
  decks:    HeroDeckPreset
  routeMix: HeroRouteMixPreset
  flag:     HeroFlagPreset
}

interface DashboardHeroDevToolbarProps {
  controls: HeroDevControls
  onChange: (next: HeroDevControls) => void
  variant?: 'floating' | 'panel'
}

const VARIANT_OPTIONS: Array<{ value: HeroKind; label: string }> = [
  { value: 'due',        label: 'Due' },
  { value: 'caught-up',  label: 'Caught up' },
  { value: 'first-time', label: 'First time' },
  { value: 'loading',    label: 'Loading' },
  { value: 'error',      label: 'Error' },
]

const QUEUE_OPTIONS: Array<{ value: HeroQueuePreset; label: string }> = [
  { value: 'one',           label: '1 card' },
  { value: 'no-backlog',    label: 'No backlog' },
  { value: 'typical',       label: 'Typical' },
  { value: 'backlog-heavy', label: 'Backlog heavy' },
  { value: 'large',         label: 'Large' },
]

const DECK_OPTIONS: Array<{ value: HeroDeckPreset; label: string }> = [
  { value: 'none',  label: 'No decks' },
  { value: 'one',   label: '1 deck' },
  { value: 'two',   label: '2 decks' },
  { value: 'three', label: '3 decks' },
  { value: 'more',  label: '3 + more' },
]

const ROUTE_MIX_OPTIONS: Array<{ value: HeroRouteMixPreset; label: string }> = [
  { value: 'balanced',     label: 'Balanced' },
  { value: 'new-heavy',    label: 'New heavy' },
  { value: 'review-heavy', label: 'Review heavy' },
]

const FLAG_OPTIONS: Array<{ value: HeroFlagPreset; label: string }> = [
  { value: 'none',       label: 'No flag' },
  { value: 'stale-data', label: 'Stale data' },
]

export function DashboardHeroDevToolbar({
  controls,
  onChange,
  variant = 'floating',
}: DashboardHeroDevToolbarProps): React.JSX.Element {
  function update<K extends keyof HeroDevControls>(key: K, value: HeroDevControls[K]): void {
    onChange({ ...controls, [key]: value })
  }

  const chromeClass = variant === 'floating'
    ? 'fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised shadow-lg px-4 py-3'
    : 'min-w-0 rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised px-4 py-3'

  return (
    <aside
      aria-label="Dashboard hero preview controls"
      className={chromeClass}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-warm-paper-raised">
          Hero preview
        </p>
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/55">
          dev only
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ToolbarSelect
          label="State"
          value={controls.variant}
          options={VARIANT_OPTIONS}
          onChange={(value) => update('variant', value as HeroKind)}
        />
        <ToolbarSelect
          label="Queue"
          value={controls.queue}
          options={QUEUE_OPTIONS}
          onChange={(value) => update('queue', value as HeroQueuePreset)}
        />
        <ToolbarSelect
          label="Decks"
          value={controls.decks}
          options={DECK_OPTIONS}
          onChange={(value) => update('decks', value as HeroDeckPreset)}
        />
        <ToolbarSelect
          label="Route mix"
          value={controls.routeMix}
          options={ROUTE_MIX_OPTIONS}
          onChange={(value) => update('routeMix', value as HeroRouteMixPreset)}
        />
        <div className="col-span-2">
          <ToolbarSelect
            label="Flag"
            value={controls.flag}
            options={FLAG_OPTIONS}
            onChange={(value) => update('flag', value as HeroFlagPreset)}
          />
        </div>
      </div>
    </aside>
  )
}

function ToolbarSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label:    string
  value:    T
  options:  Array<{ value: T; label: string }>
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={[
          'mt-1 h-9 w-full rounded-[2px] border border-warm-paper-raised/15',
          'bg-warm-paper-raised/10 px-2 text-sm text-warm-paper-raised',
          'today-motion-colors outline-none',
          'hover:border-warm-paper-raised/35',
          'focus-visible:border-warm-paper-raised focus-visible:ring-2 focus-visible:ring-warm-paper-raised/20',
        ].join(' ')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-sumi-ink text-warm-paper-raised">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
