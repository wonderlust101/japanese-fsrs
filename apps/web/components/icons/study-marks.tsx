/**
 * Study Marks: clean line-art icon family for the SRS-tool register.
 *
 * Replaces the previous `tomo-marks.tsx` (brushy, calligraphic, Iwanami-era).
 * These icons are: single 1.25 stroke weight, no fills, sharp `strokeLinecap`
 * (mitered, not round-tapered), `currentColor` for inheritance. They read as
 * "study tool icons" not "hand-brushed marks."
 */

import { motion } from 'motion/react'

const STROKE = 1.25

const COMMON_PROPS = {
  fill:           'none',
  stroke:         'currentColor',
  strokeWidth:    STROKE,
  strokeLinecap:  'round',
  strokeLinejoin: 'round',
} as const

interface IconProps {
  className?: string
  size?:      number
}

// ── Selection check (replaces brushy BrushstrokeCheck) ─────────────────────

interface CheckMarkProps {
  className?: string
  /** Animation delay in seconds. */
  delay?:    number
  /** Animate the path drawing on. Default true. */
  animate?:  boolean
}

export function CheckMark({ className = '', delay = 0, animate = true }: CheckMarkProps): React.JSX.Element {
  const pathD = 'M3.5 9 L 7.5 13 L 14.5 5'

  if (!animate) {
    return (
      <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" className={className}>
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" className={className}>
      <motion.path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{    pathLength: 0, opacity: 0 }}
        transition={{
          pathLength: { duration: 0.24, delay, ease: [0.16, 1, 0.3, 1] },
          opacity:    { duration: 0.10, delay, ease: [0.16, 1, 0.3, 1] },
        }}
      />
    </svg>
  )
}

// ── Goal step body icons (geometric, sharp, line-art) ───────────────────────

export function ToriiGate({ className = '' }: IconProps): React.JSX.Element {
  // Clean torii silhouette. No brushy taper, no opacity tricks.
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <line x1="6"  y1="9"  x2="34" y2="9"  {...COMMON_PROPS} />
      <line x1="9"  y1="13" x2="31" y2="13" {...COMMON_PROPS} />
      <line x1="9"  y1="17" x2="31" y2="17" {...COMMON_PROPS} />
      <line x1="11" y1="9"  x2="11" y2="34" {...COMMON_PROPS} />
      <line x1="29" y1="9"  x2="29" y2="34" {...COMMON_PROPS} />
    </svg>
  )
}

export function SpeechBubble({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path
        d="M7 11 L 7 23 Q 7 27, 11 27 L 17 27 L 13 33 L 21 27 L 29 27 Q 33 27, 33 23 L 33 11 Q 33 7, 29 7 L 11 7 Q 7 7, 7 11 Z"
        {...COMMON_PROPS}
      />
      <line x1="13" y1="14" x2="27" y2="14" {...COMMON_PROPS} strokeWidth={STROKE * 0.8} />
      <line x1="13" y1="18" x2="23" y2="18" {...COMMON_PROPS} strokeWidth={STROKE * 0.8} />
    </svg>
  )
}

export function BookOpen({ className = '' }: IconProps): React.JSX.Element {
  // Open book with center spine: clearly a book, not "a folded page corner."
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path
        d="M6 10 L 20 12 L 34 10 L 34 32 L 20 30 L 6 32 Z"
        {...COMMON_PROPS}
      />
      <line x1="20" y1="12" x2="20" y2="30" {...COMMON_PROPS} />
      <line x1="11" y1="16" x2="17" y2="17" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
      <line x1="11" y1="20" x2="17" y2="21" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
      <line x1="11" y1="24" x2="16" y2="24" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
      <line x1="23" y1="17" x2="29" y2="16" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
      <line x1="23" y1="21" x2="29" y2="20" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
      <line x1="23" y1="24" x2="28" y2="24" {...COMMON_PROPS} strokeWidth={STROKE * 0.6} opacity="0.65" />
    </svg>
  )
}

export function Briefcase({ className = '' }: IconProps): React.JSX.Element {
  // Briefcase: live/work in Japan. Replaces the paper crane (too brushy, too
  // tourist-shop). Geometric, professional, clearly "work / professional life."
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <rect x="6"  y="13" width="28" height="20" {...COMMON_PROPS} />
      <path  d="M14 13 L 14 9 L 26 9 L 26 13" {...COMMON_PROPS} />
      <line x1="6"  y1="22" x2="34" y2="22" {...COMMON_PROPS} />
      <rect x="18" y="20" width="4"  height="4"  {...COMMON_PROPS} strokeWidth={STROKE * 0.8} />
    </svg>
  )
}

// ── Schedule step pace icons (volume-of-water-in-glass metaphor) ───────────

export function PaceLight({ className = '' }: IconProps): React.JSX.Element {
  // Small dot inside a glass: minimum effort
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M12 8 L 28 8 L 26 32 L 14 32 Z" {...COMMON_PROPS} />
      <circle cx="20" cy="26" r="2" fill="currentColor" />
    </svg>
  )
}

export function PaceSteady({ className = '' }: IconProps): React.JSX.Element {
  // Glass half-full
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M12 8 L 28 8 L 26 32 L 14 32 Z" {...COMMON_PROPS} />
      <line x1="13.5" y1="20" x2="26.5" y2="20" {...COMMON_PROPS} strokeWidth={STROKE * 0.7} />
      <path
        d="M 13.5 20 L 26.5 20 L 26 32 L 14 32 Z"
        fill="currentColor"
        opacity="0.18"
      />
    </svg>
  )
}

export function PaceIntensive({ className = '' }: IconProps): React.JSX.Element {
  // Glass full; small drops above
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" className={className}>
      <path d="M12 8 L 28 8 L 26 32 L 14 32 Z" {...COMMON_PROPS} />
      <path
        d="M 12 8 L 28 8 L 26 32 L 14 32 Z"
        fill="currentColor"
        opacity="0.18"
      />
      <circle cx="20" cy="4"  r="0.8" fill="currentColor" />
      <circle cx="16" cy="6"  r="0.8" fill="currentColor" />
      <circle cx="24" cy="6"  r="0.8" fill="currentColor" />
    </svg>
  )
}

// ── Step header marks (compact, used in onboarding step header) ────────────

export function StepNumber({ n, className = '' }: { n: number; className?: string }): React.JSX.Element {
  // Tiny "step n" badge — circular outline + numeral
  return (
    <span
      className={[
        'inline-flex items-center justify-center w-6 h-6 rounded-full border border-current',
        'text-[11px] font-mono tabular-nums leading-none',
        className,
      ].join(' ')}
    >
      {n}
    </span>
  )
}

