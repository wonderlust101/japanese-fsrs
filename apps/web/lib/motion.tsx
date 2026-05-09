'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'

/**
 * Shared motion vocabulary for cascading entrance animations.
 *
 * The system has one canonical easing curve (ease-out-expo) and one canonical
 * unit motion (fade up 12px over 550ms). Containers vary only in stagger
 * cadence: deliberate (0.20s) for major page sections, tight (0.07s) for
 * grouped items inside a section. Surfaces that opt into this vocabulary —
 * onboarding step cards, the welcome cover, /login, /signup — share a calm,
 * considered cadence by construction. New surfaces should import from here
 * rather than redefining locally.
 */

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/**
 * Per-child cascade element. The unit motion across the system: any item
 * arriving via stagger uses these timings, so cadence stays consistent
 * across surfaces.
 */
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown:  { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
}

/**
 * Outer stagger over major page sections (header, form, footer in auth;
 * preview pane + content column in onboarding step cards).
 *
 * delayChildren holds the cascade until the page's own card-level entrance
 * has begun, so the first item arrives alongside the card's fade-in rather
 * than before it.
 */
export const staggerVariants: Variants = {
  hidden: { opacity: 1 },
  shown:  { opacity: 1, transition: { staggerChildren: 0.20, delayChildren: 0.10 } },
}

/**
 * Nested stagger for a column inside an outer-staggered section. Same per-
 * child rate as the outer level (continuation, not a new burst), no
 * delayChildren since the lead-in was already paid by the outer container.
 */
export const staggerNestedVariants: Variants = {
  hidden: { opacity: 1 },
  shown:  { opacity: 1, transition: { staggerChildren: 0.20 } },
}

/**
 * Tight stagger for body-level items (selection cards, deck rows, chips).
 * Faster than section-level so a list-of-many doesn't drip in.
 */
export const staggerTightVariants: Variants = {
  hidden: { opacity: 1 },
  shown:  { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

/**
 * Composed: fade-up the element itself AND tight-stagger its children.
 *
 * For a section that should both arrive in an outer cascade and orchestrate
 * its own inner cascade. The auth `<motion.form>` uses this so the form
 * fades into place as one of three outer sections, then its inputs cascade
 * into the form on the same beat as onboarding body items.
 *
 * Element-level (duration, ease) and orchestration-level (staggerChildren,
 * delayChildren) transition props coexist; framer-motion treats them as
 * orthogonal.
 */
export const fadeUpStaggerTightVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown:  {
    opacity:    1,
    y:          0,
    transition: {
      duration:        0.55,
      ease:            EASE_OUT_EXPO,
      staggerChildren: 0.07,
      delayChildren:   0.04,
    },
  },
}

/**
 * Wraps children in a motion.div with fadeUpVariants. Use inside any
 * stagger container so the wrapped node participates in the cascade.
 */
export function FadeUpChild({
  children,
  className = '',
}: {
  children:   React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <motion.div variants={fadeUpVariants} className={className}>
      {children}
    </motion.div>
  )
}

/**
 * Returns `initial` / `animate` variant keys for a stagger entrance that
 * fires reliably even when the component is mounted inside a nested
 * `<AnimatePresence initial={false}>`.
 *
 * Why this exists: framer-motion's PresenceContext propagates the
 * `initial={false}` flag down the motion tree. With one AnimatePresence
 * above (the auth-shell's CardStack), section staggers still play; with two
 * layers stacked (auth-shell's CardStack + signup's inner CardStack), the
 * suppression reaches deep enough to skip a SignupFormView-level stagger on
 * mount. The fix is to drive the transition via a React state change after
 * mount: PresenceContext only affects mount-time animations, so a
 * subsequent state flip ('hidden' → 'shown') always plays through.
 *
 * Honors `prefers-reduced-motion` by holding at 'shown' from the start, so
 * content arrives instantly with no transition.
 */
export function useStaggerEntrance(): {
  initial: 'hidden' | 'shown'
  animate: 'hidden' | 'shown'
} {
  const reducedMotion = useReducedMotion()
  const initial: 'hidden' | 'shown' = reducedMotion === true ? 'shown' : 'hidden'
  const [animate, setAnimate] = useState<'hidden' | 'shown'>(initial)

  useEffect(() => {
    if (reducedMotion === true) return
    setAnimate('shown')
  }, [reducedMotion])

  return { initial, animate }
}
