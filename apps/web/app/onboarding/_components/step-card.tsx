'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Card } from '@/components/ui/Card'
import {
  fadeUpVariants,
  staggerNestedVariants,
  staggerTightVariants,
  staggerVariants,
} from '@/lib/motion'

// StepChild is the onboarding-era name for the generic FadeUpChild wrapper.
// Re-exported for backward compat with the five step pages already importing
// `StepChild` from this module; new code should reach for `FadeUpChild`
// directly from `@/lib/motion`.
export { FadeUpChild as StepChild } from '@/lib/motion'

interface StepCardProps {
  /** Left pane: the SRS preview visualization. */
  previewPane: React.ReactNode
  heading:     string
  subhead:     string
  /** Right pane content: answer affordance (selection cards, chips, deck rows). */
  children:    React.ReactNode
  /** Footer row content: Back + Continue buttons. */
  footer:      React.ReactNode
}

/**
 * The shared composition for the five questionnaire steps.
 *
 * Choreography: the entire grid (preview pane + right column) is wrapped in a
 * single staggering motion container. delayChildren on that outer container is
 * tuned to wait for CardStack's foreground fade-in, so the card mounts
 * visibly empty before any content appears. Then content cascades:
 *
 *   1. Aside (preview pane) fades in
 *   2. Right column begins, header first
 *   3. Body items stagger in tightly
 *   4. Footer arrives near the end
 *
 * On `< md`, the columns stack with the aside above the question column;
 * the stagger order is preserved.
 */
export function StepCard({
  previewPane,
  heading,
  subhead,
  children,
  footer,
}: StepCardProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const initial       = reducedMotion === true ? 'shown' : 'hidden'

  return (
    <Card variant="default">
      <motion.div
        initial={initial}
        animate="shown"
        variants={staggerVariants}
        className="grid grid-cols-1 md:grid-cols-[38%_1fr] gap-8 md:gap-12"
      >
        {/* SRS preview pane (left on md, top on mobile) */}
        <motion.aside
          variants={fadeUpVariants}
          className="flex flex-col items-stretch gap-3"
        >
          <p className="text-xs font-mono uppercase tracking-[0.1em] text-faded-sumi">
            preview
          </p>
          <div className="flex-1">{previewPane}</div>
        </motion.aside>

        {/* Right column with its own inner stagger */}
        <motion.section
          variants={staggerNestedVariants}
          className="flex flex-col gap-8"
        >
          <motion.header variants={fadeUpVariants} className="flex flex-col gap-2">
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-sumi-ink leading-[1.1]">
              {heading}
            </h1>
            <p className="text-base text-faded-sumi leading-relaxed max-w-[52ch]">
              {subhead}
            </p>
          </motion.header>

          {/* Inner stagger so body items (selection cards, chips, deck rows)
              arrive one by one instead of together. */}
          <motion.div variants={staggerTightVariants}>{children}</motion.div>

          <motion.div variants={fadeUpVariants} className="mt-auto pt-2">
            {footer}
          </motion.div>
        </motion.section>
      </motion.div>
    </Card>
  )
}
