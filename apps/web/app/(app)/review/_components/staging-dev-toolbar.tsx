'use client'

export type StagingPreviewVariant =
  | 'default'
  | 'all-clear'
  | 'first-time'
  | 'backlog'
  | 'paused'
  | 'error'
  | 'loading'

export type StagingPreviewQueueShape =
  | 'one'
  | 'typical'
  | 'heavy-backlog'
  | 'review-heavy'
  | 'new-heavy'

export interface StagingDevControls {
  variant:    StagingPreviewVariant
  queueShape: StagingPreviewQueueShape
}

export const DEFAULT_STAGING_DEV_CONTROLS: StagingDevControls = {
  variant:    'default',
  queueShape: 'typical',
}

interface StagingDevToolbarProps {
  controls: StagingDevControls
  onChange: (next: StagingDevControls) => void
  onClose:  () => void
}

const VARIANT_OPTIONS: Array<{ value: StagingPreviewVariant; label: string }> = [
  { value: 'default',    label: 'Default (mid-week)' },
  { value: 'all-clear',  label: 'All clear (0 due)'  },
  { value: 'first-time', label: 'First time / no decks' },
  { value: 'backlog',    label: 'Backlog (≥20 overdue)' },
  { value: 'paused',     label: 'Paused (skipped ≥3 days)' },
  { value: 'error',      label: 'Error' },
  { value: 'loading',    label: 'Loading' },
]

const QUEUE_SHAPE_OPTIONS: Array<{ value: StagingPreviewQueueShape; label: string }> = [
  { value: 'one',           label: '1 card' },
  { value: 'typical',       label: 'Typical (12)' },
  { value: 'heavy-backlog', label: 'Heavy backlog (42)' },
  { value: 'review-heavy',  label: 'Review-heavy' },
  { value: 'new-heavy',     label: 'New-heavy' },
]

/**
 * Floating preview-controls panel for the /review staging surface. Toggled
 * by the FloatingLauncher menu via the 'tomo:review-dev-tools:toggle'
 * CustomEvent (see `apps/web/components/dev/FloatingLauncher.tsx`).
 *
 * Two control axes:
 *   - variant: the page's overall state (default / all-clear / first-time /
 *     backlog / paused / error / loading). Each variant rewires the briefing
 *     copy + CTA + fact chips and is the canonical "show me state X" knob.
 *   - queueShape: secondary axis used only when variant is 'default' or
 *     'backlog' — lets the QA flip through small / typical / heavy / mix
 *     compositions to verify pluralization, fact-chip layout, and the cap
 *     pre-fill behavior at different scales.
 *
 * Mirrors `DashboardModulesDevToolbar` chrome (dark sumi-ink panel, mono
 * uppercase tracking labels) so the two dev tools read as one family.
 */
export function StagingDevToolbar({
  controls,
  onChange,
  onClose,
}: StagingDevToolbarProps): React.JSX.Element {
  function update<K extends keyof StagingDevControls>(key: K, value: StagingDevControls[K]): void {
    onChange({ ...controls, [key]: value })
  }

  const showQueueShape = controls.variant === 'default' || controls.variant === 'backlog'

  return (
    <aside
      aria-label="Review staging preview controls"
      className={[
        'fixed bottom-4 left-4 z-50 w-[min(28rem,calc(100vw-2rem))]',
        'rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised',
        'shadow-lg px-4 py-3',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-warm-paper-raised">
          Review staging states
        </p>
        <button
          type="button"
          onClick={onClose}
          className={[
            'inline-flex h-7 items-center rounded-[2px] border border-warm-paper-raised/20',
            'px-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/85',
            'transition-colors duration-200 ease-out',
            'hover:bg-warm-paper-raised/10 hover:text-warm-paper-raised',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-warm-paper-raised focus-visible:outline-offset-2',
          ].join(' ')}
          aria-label="Close preview controls"
        >
          Close
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ToolbarSelect
          label="State"
          value={controls.variant}
          options={VARIANT_OPTIONS}
          onChange={(value) => update('variant', value)}
        />
        <ToolbarSelect
          label="Queue shape"
          value={controls.queueShape}
          options={QUEUE_SHAPE_OPTIONS}
          onChange={(value) => update('queueShape', value)}
          disabled={!showQueueShape}
          hint={showQueueShape ? undefined : 'only used in default and backlog states'}
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
  disabled,
  hint,
}: {
  label:     string
  value:     T
  options:   Array<{ value: T; label: string }>
  onChange:  (value: T) => void
  disabled?: boolean | undefined
  hint?:     string | undefined
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        disabled={disabled === true}
        className={[
          'mt-1 h-9 w-full rounded-[2px] border border-warm-paper-raised/15',
          'bg-warm-paper-raised/10 px-2 text-sm text-warm-paper-raised',
          'transition-colors duration-200 ease-out outline-none',
          'hover:border-warm-paper-raised/35',
          'focus-visible:border-warm-paper-raised focus-visible:ring-2 focus-visible:ring-warm-paper-raised/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-sumi-ink text-warm-paper-raised"
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint !== undefined && (
        <span className="mt-1 block font-mono text-[0.625rem] uppercase tracking-[0.1em] text-warm-paper-raised/45">
          {hint}
        </span>
      )}
    </label>
  )
}
