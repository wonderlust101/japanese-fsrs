'use client'

import { useId } from 'react'

/**
 * Shared class string for `<input>` and `<select>` controls used inside a
 * SettingsField. Centralised so every Settings control reads in the same
 * visual register: Cream Inset background, Soft Hairline border, hover
 * to Faded Sumi border, 3px Vermillion Wash focus halo (DESIGN.md Focus
 * Ring contract), 2px corners (DESIGN.md "cut-paper" radius).
 */
export const SETTINGS_INPUT_CLASS = [
  'h-10 w-full rounded-[2px] border border-soft-hairline bg-cream-inset px-3 text-sm text-sumi-ink',
  'ui-motion-colors hover:border-faded-sumi',
  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-vermillion-wash focus-visible:border-faded-sumi',
  'disabled:opacity-60 disabled:cursor-not-allowed',
].join(' ')

interface SettingsFieldProps {
  label:    string
  // tsconfig has `exactOptionalPropertyTypes: true`, which means `prop?: T`
  // requires the prop to be omitted entirely when not in use — passing
  // `undefined` is a type error. Each section reads `error`/`hint`/`dirty`
  // from useFieldFeedback as `T | undefined`, so the props below explicitly
  // accept `undefined` to keep the call sites direct.
  hint?:    string | undefined
  /** When true, renders a 1px Inari Vermillion gutter on the left edge of the
   *  control region. Only explicit-save fields should ever be dirty (auto-save
   *  fields commit on every edit and never need a pending indicator).
   *
   *  This is intentionally a 1px state cue on a single form field, not a
   *  decorative side-stripe on a container. The side-stripe ban in the shared
   *  design laws targets >1px colored stripes on cards, list items, and
   *  alerts; a 1px field-level indicator is the form-control analogue of a
   *  focus ring. */
  dirty?:   boolean | undefined
  /** When true, renders an inline `✓ saved` tick beside the label. The tick
   *  fades out automatically via useFieldFeedback's 1500ms timer; this prop
   *  just reflects whether the timer is currently running. */
  saved?:   boolean | undefined
  error?:   string  | undefined
  htmlFor?: string  | undefined
  /** Right-aligned content beside the label. Used by sliders to show the live
   *  value readout in mono ('15 cards / day'). */
  endLabel?: React.ReactNode
  children:  React.ReactNode
}

/**
 * The shared field wrapper for every control in Settings. Composes label,
 * dirty gutter, saved tick, error/hint, and an optional right-aligned
 * end-label into one rhythm.
 *
 * The control region keeps its 0.75rem (pl-3) left padding regardless of
 * dirty state so the field doesn't shift horizontally when committing. The
 * border-left color transitions between transparent and Inari Vermillion.
 */
export function SettingsField({
  label,
  hint,
  dirty   = false,
  saved   = false,
  error,
  htmlFor,
  endLabel,
  children,
}: SettingsFieldProps): React.JSX.Element {
  const generatedId = useId()
  const id = htmlFor ?? generatedId

  return (
    <div className="grid grid-cols-1 gap-1.5">
      <div className="flex items-baseline justify-between gap-3 pl-3">
        <label
          htmlFor={id}
          className="inline-flex items-center gap-2 text-sm font-medium text-sumi-ink"
        >
          <span>{label}</span>
          <SavedTick visible={saved} />
        </label>
        {endLabel !== undefined && (
          <span className="font-mono text-xs tabular-nums text-faded-sumi">
            {endLabel}
          </span>
        )}
      </div>

      <div
        className={[
          'border-l pl-3 transition-colors duration-200 ease-out',
          dirty ? 'border-inari-vermillion' : 'border-transparent',
        ].join(' ')}
      >
        {children}
      </div>

      {(error !== undefined || hint !== undefined) && (
        <p
          role={error !== undefined ? 'alert' : undefined}
          className={[
            'pl-3 text-xs',
            error !== undefined ? 'text-error' : 'text-faded-sumi',
          ].join(' ')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

function SavedTick({ visible }: { visible: boolean }): React.JSX.Element {
  // The tick uses `jlpt-n5-fresh-leaf` (#15803D), a deep emerald already in
  // the system as the N5 badge color. Using a tokenized green avoids
  // inventing a new "success" hue and ties the saved feedback into the
  // existing palette (the same hue lives on the Good rating button).
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      aria-hidden={visible ? undefined : true}
      className={[
        'inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.16em]',
        'text-jlpt-n5-fresh-leaf transition-opacity duration-300 ease-out',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <span aria-hidden="true">✓</span>
      <span>saved</span>
    </span>
  )
}
