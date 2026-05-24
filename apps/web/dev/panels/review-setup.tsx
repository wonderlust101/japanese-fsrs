'use client'

import { useCallback, useState } from 'react'

import { useDevPanel } from '@/dev'

import { DockSelect } from './today'

// ── Public types ─────────────────────────────────────────────────────────────

export type SetupPreviewState =
  | 'normal'
  | 'modified'
  | 'no-reviews'
  | 'offline'
  | 'loading'
  | 'error'
  | 'first-time'

export type SetupPreviewQueueShape =
  | 'small'
  | 'typical'
  | 'review-heavy'
  | 'new-heavy'
  | 'overdue'

export interface SetupDevControls {
  state:      SetupPreviewState
  queueShape: SetupPreviewQueueShape
}

const DEFAULT_CONTROLS: SetupDevControls = {
  state:      'normal',
  queueShape: 'typical',
}

const STATE_OPTIONS: ReadonlyArray<{ value: SetupPreviewState; label: string }> = [
  { value: 'normal',     label: 'Normal'                    },
  { value: 'modified',   label: 'Modified (tuning changed)' },
  { value: 'no-reviews', label: 'No reviews available'      },
  { value: 'offline',    label: 'Offline (cached data)'     },
  { value: 'loading',    label: 'Loading'                   },
  { value: 'error',      label: 'Error'                     },
  { value: 'first-time', label: 'First time (no decks)'     },
]

const QUEUE_OPTIONS: ReadonlyArray<{ value: SetupPreviewQueueShape; label: string }> = [
  { value: 'small',        label: 'Small (10)'        },
  { value: 'typical',      label: 'Typical (47)'      },
  { value: 'review-heavy', label: 'Review-heavy (60)' },
  { value: 'new-heavy',    label: 'New-heavy (30)'    },
  { value: 'overdue',      label: 'Overdue (38)'      },
]

export interface ReviewSetupDevState {
  controls:       SetupDevControls
  previewActive:  boolean
}

/**
 * Register the Review Setup dev panel. Returns the current controls plus
 * `previewActive` (true whenever any control deviates from default).
 */
export function useReviewSetupDevState(): ReviewSetupDevState {
  const [controls, setControls] = useState<SetupDevControls>(DEFAULT_CONTROLS)

  const previewActive =
    controls.state !== DEFAULT_CONTROLS.state ||
    controls.queueShape !== DEFAULT_CONTROLS.queueShape

  const render = useCallback((): React.JSX.Element => {
    function update<K extends keyof SetupDevControls>(key: K, value: SetupDevControls[K]): void {
      setControls((prev) => ({ ...prev, [key]: value }))
    }
    const queueDisabled =
      controls.state === 'loading'    ||
      controls.state === 'error'      ||
      controls.state === 'no-reviews' ||
      controls.state === 'first-time'
    return (
      <div className="grid grid-cols-2 gap-2">
        <DockSelect
          label="State"
          value={controls.state}
          options={STATE_OPTIONS}
          onChange={(v) => update('state', v)}
        />
        <DockSelect
          label="Queue shape"
          value={controls.queueShape}
          options={QUEUE_OPTIONS}
          onChange={(v) => update('queueShape', v)}
          disabled={queueDisabled}
        />
      </div>
    )
  }, [controls.state, controls.queueShape])

  const activeLabel =
    STATE_OPTIONS.find((o) => o.value === controls.state)?.label ?? 'Normal'

  useDevPanel({
    id:    'review.setup',
    title: 'Review · Setup',
    render,
    activeLabel,
  })

  return { controls, previewActive }
}
