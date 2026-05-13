'use client'

export type ModulePreviewState = 'default' | 'loading' | 'empty' | 'error' | 'unavailable'

export interface ModuleDevControls {
  tomo:     ModulePreviewState
  forecast: ModulePreviewState
  decks:    ModulePreviewState
  leeches:  ModulePreviewState
  recent:   ModulePreviewState
}

interface DashboardModulesDevToolbarProps {
  controls: ModuleDevControls
  onChange: (next: ModuleDevControls) => void
  variant?: 'floating' | 'panel'
}

const STATE_OPTIONS: Array<{ value: ModulePreviewState; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'loading', label: 'Loading' },
  { value: 'empty',   label: 'Empty'   },
  { value: 'error',   label: 'Error'   },
  { value: 'unavailable', label: 'Unavailable' },
]

const MODULE_OPTIONS: Array<{ key: keyof ModuleDevControls; label: string }> = [
  { key: 'forecast', label: 'Forecast' },
  { key: 'decks',    label: 'Decks'    },
  { key: 'leeches',  label: 'Leeches'  },
  { key: 'recent',   label: 'Recent'   },
  { key: 'tomo',     label: 'Signal'   },
]

export function DashboardModulesDevToolbar({
  controls,
  onChange,
  variant = 'floating',
}: DashboardModulesDevToolbarProps): React.JSX.Element {
  function update(key: keyof ModuleDevControls, value: ModulePreviewState): void {
    onChange({ ...controls, [key]: value })
  }

  const chromeClass = variant === 'floating'
    ? 'fixed bottom-4 left-4 z-50 w-[min(25rem,calc(100vw-2rem))] rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised shadow-lg px-4 py-3'
    : 'min-w-0 rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised px-4 py-3'

  return (
    <aside
      aria-label="Dashboard module preview controls"
      className={chromeClass}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-warm-paper-raised">
          Module states
        </p>
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/55">
          dev only
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MODULE_OPTIONS.map((option) => (
          <ToolbarSelect
            key={option.key}
            label={option.label}
            value={controls[option.key]}
            options={STATE_OPTIONS}
            onChange={(value) => update(option.key, value)}
          />
        ))}
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
          'dashboard-motion-colors outline-none',
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
