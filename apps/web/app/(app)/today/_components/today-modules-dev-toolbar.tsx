'use client'

/**
 * Dev-only preview controls for the secondary modules on Today.
 *
 * Today's only secondary module after the redesign is the WeekRhythmStrip
 * ("The week ahead"). Earlier iterations of the page rendered a forecast
 * chart, active decks, weakSpots, recent activity, and a practice signal —
 * those modules were detached during the redesign and their preview
 * controls came with them. This toolbar now exposes just the strip, with
 * two orthogonal axes: a render state (default / loading / error) and a
 * data pattern (the week's overall shape).
 */

export type WeekRhythmPreviewState = 'default' | 'loading' | 'error'

export type WeekRhythmPattern =
  | 'typical'        // mixed mid-volume days, today highest
  | 'caught-up'      // all zeros — empty quiet week
  | 'backlog-heavy'  // overdue dominant on today, decreases over week
  | 'new-heavy'      // a lot of new cards each day
  | 'ramp-up'        // load grows day by day
  | 'winding-down'   // load decreases day by day
  | 'busy-today'     // today huge, rest tiny

export interface ModuleDevControls {
  weekState:   WeekRhythmPreviewState
  weekPattern: WeekRhythmPattern
}

interface DashboardModulesDevToolbarProps {
  controls: ModuleDevControls
  onChange: (next: ModuleDevControls) => void
  variant?: 'floating' | 'panel'
}

const STATE_OPTIONS: Array<{ value: WeekRhythmPreviewState; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'loading', label: 'Loading' },
  { value: 'error',   label: 'Error'   },
]

const PATTERN_OPTIONS: Array<{ value: WeekRhythmPattern; label: string }> = [
  { value: 'typical',       label: 'Typical mix'    },
  { value: 'busy-today',    label: 'Busy today'     },
  { value: 'backlog-heavy', label: 'Backlog heavy'  },
  { value: 'new-heavy',     label: 'New heavy'      },
  { value: 'ramp-up',       label: 'Ramping up'     },
  { value: 'winding-down',  label: 'Winding down'   },
  { value: 'caught-up',     label: 'Caught up week' },
]

export function DashboardModulesDevToolbar({
  controls,
  onChange,
  variant = 'floating',
}: DashboardModulesDevToolbarProps): React.JSX.Element {
  function update<K extends keyof ModuleDevControls>(key: K, value: ModuleDevControls[K]): void {
    onChange({ ...controls, [key]: value })
  }

  const chromeClass = variant === 'floating'
    ? 'fixed bottom-4 left-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised shadow-lg px-4 py-3'
    : 'min-w-0 rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised px-4 py-3'

  return (
    <aside
      aria-label="Week ahead preview controls"
      className={chromeClass}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-warm-paper-raised">
          Week ahead preview
        </p>
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/55">
          dev only
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <ToolbarSelect
          label="State"
          value={controls.weekState}
          options={STATE_OPTIONS}
          onChange={(value) => update('weekState', value as WeekRhythmPreviewState)}
        />
        <ToolbarSelect
          label="Pattern"
          value={controls.weekPattern}
          options={PATTERN_OPTIONS}
          onChange={(value) => update('weekPattern', value as WeekRhythmPattern)}
        />
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
