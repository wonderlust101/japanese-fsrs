'use client'

import { cloneElement, isValidElement, useId, type ReactElement } from 'react'

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

  // Associate the error/hint line with the control for screen readers: give
  // the feedback <p> an id and forward it to the single child via
  // aria-describedby (plus aria-invalid on error). The settings controls
  // (Input/Textarea) spread unknown props onto their native element, so the
  // attributes land where a screen reader can read them on focus — not only
  // via the role="alert" flash. Mirrors the DeckField pattern in add-client.
  const feedbackId  = `${id}-feedback`
  const hasFeedback = error !== undefined || hint !== undefined
  const control     = isValidElement(children) && hasFeedback
    ? cloneElement(
        children as ReactElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>,
        {
          'aria-describedby': feedbackId,
          ...(error !== undefined ? { 'aria-invalid': true } : {}),
        },
      )
    : children

  return (
    <div className="grid grid-cols-1 gap-2">
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
        {control}
      </div>

      {(error !== undefined || hint !== undefined) && (
        <p
          id={feedbackId}
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
        'inline-flex items-center gap-1 font-mono text-sm',
        'text-jlpt-n5-fresh-leaf transition-opacity duration-300 ease-out',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <span aria-hidden="true">✓</span>
      <span>saved</span>
    </span>
  )
}
