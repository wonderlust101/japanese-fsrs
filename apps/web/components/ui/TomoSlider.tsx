'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

interface TomoSliderProps {
  value:           number
  min:             number
  max:             number
  step?:           number
  /** Step used by Shift+Arrow / PageUp / PageDown. Defaults to 10*step. */
  largeStep?:      number
  onValueChange:   (v: number) => void
  /** Called once on commit boundaries: pointerup, keyup, blur during drag.
   *  Sections use this to decide when to PATCH the server. */
  onValueCommit?:  (v: number) => void
  /** Format the readout pill that appears above the thumb during drag.
   *  Default is the raw value rendered as a string. */
  formatValue?:    (v: number) => string
  id?:             string
  ariaLabel?:      string
  ariaLabelledBy?: string
  disabled?:       boolean
  className?:      string
}

/**
 * Brand-native range slider. Built div-based with the WAI-ARIA `slider`
 * role rather than the native `<input type="range">` so the visual register
 * matches the rest of Tomo's primitives exactly:
 *
 *   Track:  4px tall, Cream Inset background, 1px Soft Hairline border, fully
 *           rounded. Reads as a hairline on warm paper.
 *   Fill:   absolute, Inari Vermillion, width = progress%.
 *   Thumb:  18px Inari Vermillion disc. Hover gets a faint Vermillion Wash
 *           halo. Active press gets an inset shadow ("press is felt as ink,
 *           not as movement") and shifts to Inari Vermillion Deep.
 *   Readout: small mono tabular-num pill above the thumb, visible while the
 *           slider is interacting (drag, key held, or within 600ms after
 *           release). Fades out via opacity transition; the pill never
 *           shifts layout, so there's no layout thrash.
 *
 * Keyboard contract follows the ARIA Practices Guide:
 *   ArrowLeft / ArrowDown   - decrease by step
 *   ArrowRight / ArrowUp    - increase by step
 *   Shift + Arrow           - decrease/increase by largeStep
 *   Home / End              - jump to min / max
 *   PageUp / PageDown       - increase/decrease by largeStep
 *
 * Pointer interaction uses Pointer Events with setPointerCapture so a drag
 * that starts on the thumb continues even if the cursor leaves the track.
 * Pointerdown on the track (not the thumb) jumps the thumb to the press
 * position and immediately enters drag mode, matching native slider UX.
 */
export function TomoSlider({
  value, min, max, step = 1,
  largeStep,
  onValueChange, onValueCommit,
  formatValue,
  id, ariaLabel, ariaLabelledBy,
  disabled = false,
  className,
}: TomoSliderProps): React.JSX.Element {
  const generatedId = useId()
  const sliderId    = id ?? generatedId
  const trackRef    = useRef<HTMLDivElement | null>(null)
  const interactingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [isDragging,  setIsDragging]  = useState(false)
  const [interacting, setInteracting] = useState(false)

  const effectiveLargeStep = largeStep ?? step * 10

  // Snap to step and clamp to [min, max]. Uses fixed-precision rounding so
  // floating-point drift on fractional steps (e.g. retention target stepping
  // 0.01) doesn't produce values like 0.799999.
  const snapToStep = useCallback((raw: number): number => {
    const stepped = Math.round((raw - min) / step) * step + min
    const decimals = (step.toString().split('.')[1] ?? '').length
    const rounded  = decimals > 0 ? Number(stepped.toFixed(decimals)) : Math.round(stepped)
    return Math.max(min, Math.min(max, rounded))
  }, [min, max, step])

  const valueFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current
    if (track === null) return value
    const rect  = track.getBoundingClientRect()
    if (rect.width <= 0) return value
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return snapToStep(min + ratio * (max - min))
  }, [value, min, max, snapToStep])

  // Visible interaction window: extend to 600ms past the last user input so
  // the readout pill survives a brief release without flashing in and out
  // when the user pauses mid-drag.
  const flagInteracting = useCallback((): void => {
    setInteracting(true)
    if (interactingTimerRef.current !== null) clearTimeout(interactingTimerRef.current)
    interactingTimerRef.current = setTimeout(() => {
      setInteracting(false)
      interactingTimerRef.current = null
    }, 600)
  }, [])

  useEffect(() => {
    return () => {
      if (interactingTimerRef.current !== null) clearTimeout(interactingTimerRef.current)
    }
  }, [])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (disabled) return
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    setIsDragging(true)
    flagInteracting()
    const next = valueFromClientX(e.clientX)
    if (next !== value) onValueChange(next)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    if (!isDragging || disabled) return
    flagInteracting()
    const next = valueFromClientX(e.clientX)
    if (next !== value) onValueChange(next)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    if (!isDragging) return
    const target = e.currentTarget
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
    setIsDragging(false)
    onValueCommit?.(value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return
    const useLarge = e.shiftKey
    let next: number | null = null
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = snapToStep(value - (useLarge ? effectiveLargeStep : step))
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = snapToStep(value + (useLarge ? effectiveLargeStep : step))
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
      case 'PageDown':
        next = snapToStep(value - effectiveLargeStep)
        break
      case 'PageUp':
        next = snapToStep(value + effectiveLargeStep)
        break
      default:
        return
    }
    e.preventDefault()
    flagInteracting()
    if (next !== null && next !== value) onValueChange(next)
  }

  function handleKeyUp(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return
    // Commit on keyup so a holding-arrow-key drag fires one commit per press.
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      onValueCommit?.(value)
    }
  }

  const progress  = max === min ? 0 : (value - min) / (max - min)
  const progressPct = `${progress * 100}%`
  const readoutText = formatValue?.(value) ?? String(value)

  return (
    <div
      id={sliderId}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={readoutText}
      aria-disabled={disabled ? true : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-orientation="horizontal"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={[
        'group relative h-10 w-full touch-none select-none',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        'focus-visible:outline-none',
        className ?? '',
      ].join(' ')}
    >
      {/* Track */}
      <div
        ref={trackRef}
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[5px] rounded-full bg-cream-inset border border-soft-hairline"
      >
        {/* Fill */}
        <div
          aria-hidden="true"
          className={[
            'absolute left-0 top-0 bottom-0 rounded-full',
            isDragging ? 'bg-inari-vermillion-deep' : 'bg-inari-vermillion',
            isDragging ? '' : 'transition-[width] duration-75 ease-out',
          ].join(' ')}
          style={{ width: progressPct }}
        />
      </div>

      {/* Thumb */}
      <span
        aria-hidden="true"
        className={[
          'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
          'h-[18px] w-[18px] rounded-full',
          'border border-inari-vermillion-deep/30',
          isDragging
            ? 'bg-inari-vermillion-deep shadow-pressed-strong'
            : 'bg-inari-vermillion',
          // Hover halo only when not dragging (avoid the ring competing with
          // the pressed state)
          // Hover halo stays a soft vermillion-wash; keyboard focus gets the
          // app's standard sumi-ink ring instead (the wash ring is ~1.1:1 and
          // fails WCAG 1.4.11/2.4.11, so it can't be the sole focus indicator).
          !isDragging && !disabled
            ? 'group-hover:ring-4 group-hover:ring-vermillion-wash group-focus-visible:ring-2 group-focus-visible:ring-sumi-ink'
            : '',
          'transition-shadow duration-150 ease-out',
        ].join(' ')}
        style={{ left: progressPct }}
      />

      {/* Readout pill — opacity-controlled so it never causes layout
          thrash. Positioned with `left: progress%` and a 50% transform
          so it tracks the thumb horizontally. */}
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute -translate-x-1/2',
          // Sit just above the thumb's resting top (slider is h-10, thumb is
          // mid-height); -top-1 lifts the pill so its bottom edge clears
          // the thumb's hover halo.
          'top-[-1.25rem]',
          'inline-flex items-center rounded-full border border-soft-hairline bg-warm-paper-raised px-2 py-0.5',
          'font-mono text-sm tabular-nums text-sumi-ink',
          'transition-opacity duration-300 ease-out',
          interacting ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        style={{ left: progressPct }}
      >
        {readoutText}
      </span>
    </div>
  )
}
